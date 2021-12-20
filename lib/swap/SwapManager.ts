import { Op } from 'sequelize';
import { randomBytes } from 'crypto';
import { crypto } from 'bitcoinjs-lib';
import { OutputType, reverseSwapScript, swapScript } from 'boltz-core';
import Errors from './Errors';
import Logger from '../Logger';
import Swap from '../db/models/Swap';
import SwapNursery from './SwapNursery';
import LndClient from '../lightning/LndClient';
import RateProvider from '../rates/RateProvider';
import SwapRepository from '../db/SwapRepository';
import ReverseSwap from '../db/models/ReverseSwap';
import { ReverseSwapOutputType } from '../consts/Consts';
import RoutingHintsProvider from './RoutingHintsProvider';
import ReverseSwapRepository from '../db/ReverseSwapRepository';
import InvoiceExpiryHelper from '../service/InvoiceExpiryHelper';
import WalletManager, { Currency } from '../wallet/WalletManager';
import TimeoutDeltaProvider from '../service/TimeoutDeltaProvider';
import ChannelCreationRepository from '../db/ChannelCreationRepository';
import { ChannelCreationType, CurrencyType, OrderSide, SwapUpdateEvent } from '../consts/Enums';
import {
  decodeInvoice,
  formatError,
  generateId,
  getChainCurrency,
  getHexBuffer,
  getHexString,
  getLightningCurrency,
  getPairId,
  getPrepayMinerFeeInvoiceMemo,
  getScriptHashFunction,
  getSendingReceivingCurrency,
  getSwapMemo,
  getUnixTime,
  reverseBuffer,
  splitPairId,
  stringify,
} from '../Utils';
import { getInfo } from '../wallet/stacks/StacksUtils';
import SIP10WalletProvider from '../wallet/providers/SIP10WalletProvider';
import ChainTipRepository from '../db/ChainTipRepository';

type ChannelCreationInfo = {
  auto: boolean,
  private: boolean,
  inboundLiquidity: number,
};

type SetSwapInvoiceResponse = {
  channelCreationError?: string;
};

class SwapManager {
  public currencies = new Map<string, Currency>();

  public nursery: SwapNursery;

  public swapRepository: SwapRepository;
  public reverseSwapRepository: ReverseSwapRepository;
  public channelCreationRepository: ChannelCreationRepository;

  public routingHints!: RoutingHintsProvider;

  constructor(
    private logger: Logger,
    private walletManager: WalletManager,
    rateProvider: RateProvider,
    private invoiceExpiryHelper: InvoiceExpiryHelper,
    private swapOutputType: OutputType,
    retryInterval: number,
  ) {
    this.channelCreationRepository = new ChannelCreationRepository();

    this.swapRepository = new SwapRepository();
    this.reverseSwapRepository = new ReverseSwapRepository();
    this.nursery = new SwapNursery(
      this.logger,
      rateProvider,
      this.walletManager,
      this.swapRepository,
      this.reverseSwapRepository,
      this.channelCreationRepository,
      this.swapOutputType,
      retryInterval,
    );
  }

  public init = async (currencies: Currency[]): Promise<void>=> {
    // console.log("***swapmanager.ts init");
    currencies.forEach((currency) => {
      this.currencies.set(currency.symbol, currency);
    });

    await this.nursery.init(currencies);

    const [pendingSwaps, pendingReverseSwaps] = await Promise.all([
      this.swapRepository.getSwaps({
        status: {
          [Op.not]: [
            SwapUpdateEvent.SwapExpired,
            SwapUpdateEvent.InvoicePending,
            SwapUpdateEvent.InvoiceFailedToPay,
            SwapUpdateEvent.TransactionClaimed,
          ],
        } as any,
      }),
      this.reverseSwapRepository.getReverseSwaps({
        status: {
          [Op.not]: [
            SwapUpdateEvent.SwapExpired,
            SwapUpdateEvent.InvoiceSettled,
            SwapUpdateEvent.TransactionFailed,
            SwapUpdateEvent.TransactionRefunded,
          ],
        } as any,
      }),
    ]);

    this.recreateFilters(pendingSwaps, false);
    this.recreateFilters(pendingReverseSwaps, true);

    this.logger.info('Recreated input and output filters and invoice subscriptions');

    const lndClients: LndClient[] = [];

    for (const currency of currencies) {
      if (currency.lndClient) {
        lndClients.push(currency.lndClient);
      }
    }

    this.routingHints = new RoutingHintsProvider(
      this.logger,
      lndClients,
    );
    await this.routingHints.start();
  }

  /**
   * Creates a new Submarine Swap from the chain to Lightning with a preimage hash
   */
  public createSwap = async (args: {
    baseCurrency: string,
    quoteCurrency: string,
    orderSide: OrderSide,
    preimageHash: Buffer,
    timeoutBlockDelta: number,

    channel?: ChannelCreationInfo,

    // Only required for UTXO based chains
    refundPublicKey?: Buffer,

    // for onchainswaps
    bip21?: string,
    expectedAmount?: number,
    acceptZeroConf?: boolean,
    claimAddress?: string,
    requestedAmount?: number,
    quoteAmount?: number,
    baseAmount?: number,
    onchainTimeoutBlockDelta?: number,
    // claimPublicKey?: string,
  }): Promise<{
    id: string,
    timeoutBlockHeight: number,

    // This is either the generated address for Bitcoin like chains, or the address of the contract
    // to which the user should send the lockup transaction for Ether and ERC20 tokens
    address: string,

    // Only set for Bitcoin like, UTXO based, chains
    redeemScript?: string,

    // Specified when either Ether or ERC20 tokens or swapped to Lightning
    // So that the user can specify the claim address (Boltz) in the lockup transaction to the contract
    claimAddress?: string,

    // // only for sip10 swaps
    // tokenAddress?: string,

    asTimeoutBlockHeight?: number,
  }> => {
    // this.logger.error('swapmanager.166 ARGS ' + stringify(args));
    const { sendingCurrency, receivingCurrency } = this.getCurrencies(args.baseCurrency, args.quoteCurrency, args.orderSide);

    // for btc -> stx submarine sell
    if (!sendingCurrency.lndClient && !sendingCurrency.stacksClient) {
      throw Errors.NO_LND_CLIENT(sendingCurrency.symbol);
    }

    const id = generateId();

    // Creating new Swap from BTC to STX
    this.logger.verbose(`Creating new Swap from ${receivingCurrency.symbol} to ${sendingCurrency.symbol}: ${id}`);

    const pair = getPairId({ base: args.baseCurrency, quote: args.quoteCurrency });

    let address: string;
    let timeoutBlockHeight: number;

    let redeemScript: Buffer | undefined;

    let claimAddress: string | undefined;

    let asTimeoutBlockHeight: number;
    asTimeoutBlockHeight = 0;
    // let tokenAddress: string | undefined;

    let quoteAmount: number | undefined;
    let baseAmount: number | undefined;

    if (receivingCurrency.type === CurrencyType.BitcoinLike) {
      const { blocks } = await receivingCurrency.chainClient!.getBlockchainInfo();
      timeoutBlockHeight = blocks + args.timeoutBlockDelta;

      const chainTipRepository = new ChainTipRepository();
      const otherChainTip = await chainTipRepository.findOrCreateTip(sendingCurrency.symbol, 0);
      asTimeoutBlockHeight = otherChainTip.height + args.timeoutBlockDelta;
      console.log('chainTipRepository ', sendingCurrency.symbol, otherChainTip, asTimeoutBlockHeight);
      // it works because stx blocktime = btc blocktime

      const { keys, index } = receivingCurrency.wallet.getNewKeys();
      console.log('receiving currency BitcoinLike ', keys, index);

      console.log('sm.226 create swapScript ', getHexString(args.preimageHash), getHexString(keys.publicKey), getHexString(args.refundPublicKey!));
      redeemScript = swapScript(
        args.preimageHash,
        keys.publicKey,
        args.refundPublicKey!,
        timeoutBlockHeight,
      );

      const encodeFunction = getScriptHashFunction(this.swapOutputType);
      const outputScript = encodeFunction(redeemScript);

      address = receivingCurrency.wallet.encodeAddress(outputScript);
      console.log('sn.238 address, outputScript, redeemScript', address, outputScript, redeemScript);

      receivingCurrency.chainClient!.addOutputFilter(outputScript);

      console.log('sm.221 ', sendingCurrency.type, args.quoteCurrency);
      const contractAddress = this.getLockupContractAddress(sendingCurrency.type, args.quoteCurrency);

      // atomic swap user:btc -> stx
      this.logger.info('swapmanager.220 createswap data: ' + stringify({
        id,
        pair,
        timeoutBlockHeight,

        keyIndex: index,
        orderSide: args.orderSide,
        lockupAddress: address,
        contractAddress,
        status: SwapUpdateEvent.SwapCreated,
        preimageHash: getHexString(args.preimageHash),
        redeemScript: getHexString(redeemScript),
        claimAddress: args.claimAddress,
        requestedAmount: args.requestedAmount,
        asTimeoutBlockHeight,
        quoteAmount,
        baseAmount,
      }));

      await this.swapRepository.addSwap({
        id,
        pair,
        timeoutBlockHeight,

        keyIndex: index,
        orderSide: args.orderSide,
        lockupAddress: address,
        status: SwapUpdateEvent.SwapCreated,
        preimageHash: getHexString(args.preimageHash),
        redeemScript: getHexString(redeemScript),
        claimAddress: args.claimAddress,
        contractAddress,
        asRequestedAmount: args.requestedAmount,
        asTimeoutBlockHeight,
        quoteAmount: args.quoteAmount,
        baseAmount: args.baseAmount,
      });
    } else if (receivingCurrency.type === CurrencyType.Stx || receivingCurrency.type === CurrencyType.Sip10 ) {
      address = this.getLockupContractAddress(receivingCurrency.type, args.quoteCurrency);

      // this.logger.error("swapmanager.218 " + receivingCurrency.provider!);
      // const blockNumber = await receivingCurrency.provider!.getBlockNumber();

      const info = await getInfo();
      const blockNumber = info.stacks_tip_height;
      timeoutBlockHeight = blockNumber + args.timeoutBlockDelta;

      const chainTipRepository = new ChainTipRepository();
      const otherChainTip = await chainTipRepository.findOrCreateTip(receivingCurrency.symbol, 0);
      asTimeoutBlockHeight = otherChainTip.height + args.timeoutBlockDelta;
      console.log('chainTipRepository ', receivingCurrency.symbol, otherChainTip, asTimeoutBlockHeight);
      // it works because stx blocktime = btc blocktime

      // this.logger.error("swapmanager.227 " + stringify(receivingCurrency));
      claimAddress = await receivingCurrency.wallet.getAddress();
      // claimAddress = await receivingCurrency.wallet.

      let tokenAddressHolder = Buffer.from('', 'utf8');
      if(receivingCurrency.type === CurrencyType.Sip10) {
        const tokenWallet = receivingCurrency.wallet.walletProvider as SIP10WalletProvider;
        tokenAddressHolder = Buffer.from(tokenWallet.getTokenContractAddress() + '.' + tokenWallet.getTokenContractName(), 'utf8');
        redeemScript = tokenAddressHolder;
      }

      // stx->btc atomic swap
      let lockupAddress = '';
      // let keyIndex = 0;
      let asRedeemScript = '';
      if (args.baseAmount && args.onchainTimeoutBlockDelta){

        // index
        const { keys } = sendingCurrency.wallet.getNewKeys();
        const { blocks } = await sendingCurrency.chainClient!.getBlockchainInfo();
        timeoutBlockHeight = blocks + args.onchainTimeoutBlockDelta;
        // redeemScript = reverseSwapScript(
        //   args.preimageHash,
        //   // args.claimPublicKey!, - use refundPublicKey instead from user
        //   // args.claimAddress!, - not added
        //   args.refundPublicKey!,
        //   keys.publicKey, // refund public key to lnstxbridge
        //   timeoutBlockHeight,
        // );
        // asRedeemScript = getHexString(redeemScript);
        // console.log('sm.320 reverseSwapScript can be claimed by ', getHexString(args.refundPublicKey!), ' refund to ', getHexString(keys.publicKey));
        // console.log('sm.321 asRedeemScript ', asRedeemScript);

        // const outputScript = getScriptHashFunction(ReverseSwapOutputType)(redeemScript);
        // lockupAddress = sendingCurrency.wallet.encodeAddress(outputScript);
        // keyIndex = index;
        // console.log('lockupAddress + keyIndex ', lockupAddress, keyIndex);

        // generate swapscript instead of reverseswap script?!
        // console.log('generating swapscript with ', getHexString(args.preimageHash), getHexString(args.refundPublicKey!), getHexString(keys.publicKey), timeoutBlockHeight);
        // redeemScript = swapScript(
        //   args.preimageHash,
        //   // keys.publicKey,
        //   args.refundPublicKey!,
        //   keys.publicKey,
        //   // args.refundPublicKey!,
        //   timeoutBlockHeight,
        // );
        // asRedeemScript = getHexString(redeemScript);
        // const encodeFunction = getScriptHashFunction(this.swapOutputType);
        // const outputScript = encodeFunction(redeemScript);
        // lockupAddress = sendingCurrency.wallet.encodeAddress(outputScript);
        // console.log('sm.341 outputScript, lockupAddress ', getHexString(outputScript), lockupAddress);


        // using reverseswapscript
        console.log('generating reverseswapscript with ', getHexString(args.preimageHash), getHexString(args.refundPublicKey!), getHexString(keys.publicKey), timeoutBlockHeight);
        redeemScript = reverseSwapScript(
          args.preimageHash,
          args.refundPublicKey!,
          // args.claimPublicKey!,
          keys.publicKey,
          timeoutBlockHeight,
        );
        asRedeemScript = getHexString(redeemScript);
        const outputScript = getScriptHashFunction(ReverseSwapOutputType)(redeemScript);
        lockupAddress = sendingCurrency.wallet.encodeAddress(outputScript);
        console.log('sm.360 outputScript, lockupAddress ', getHexString(outputScript), lockupAddress);
      }
      this.logger.info('swapmanager.228 createswap data: ' + stringify({
        id,
        pair,
        timeoutBlockHeight,
        lockupAddress: address,
        orderSide: args.orderSide,
        status: SwapUpdateEvent.SwapCreated,
        preimageHash: getHexString(args.preimageHash),
        tokenAddress: getHexString(tokenAddressHolder),
        claimAddress: args.claimAddress,
        quoteAmount: args.quoteAmount,
        baseAmount: args.baseAmount,
        asRedeemScript,
        asLockupAddress: lockupAddress,
        asTimeoutBlockHeight,
        // keyIndex,
      }));

      await this.swapRepository.addSwap({
        id,
        pair,
        timeoutBlockHeight,

        lockupAddress: address,
        orderSide: args.orderSide,
        status: SwapUpdateEvent.SwapCreated,
        preimageHash: getHexString(args.preimageHash),
        redeemScript: getHexString(tokenAddressHolder),
        claimAddress: args.claimAddress,
        quoteAmount: args.quoteAmount,
        baseAmount: args.baseAmount,
        asRedeemScript,
        asLockupAddress: lockupAddress,
        asTimeoutBlockHeight,
        // keyIndex,
        // tokenAddress: tokenAddress,
      });
    } else {
      address = this.getLockupContractAddress(receivingCurrency.type, args.quoteCurrency);

      // undefined!
      this.logger.info('swapmanager.237 ' + receivingCurrency.provider!);
      const blockNumber = await receivingCurrency.provider!.getBlockNumber();
      timeoutBlockHeight = blockNumber + args.timeoutBlockDelta;

      claimAddress = await receivingCurrency.wallet.getAddress();

      await this.swapRepository.addSwap({
        id,
        pair,
        timeoutBlockHeight,

        lockupAddress: address,
        orderSide: args.orderSide,
        status: SwapUpdateEvent.SwapCreated,
        preimageHash: getHexString(args.preimageHash),
        claimAddress: args.claimAddress,
        quoteAmount: args.quoteAmount,
        baseAmount: args.baseAmount,
      });
    }

    if (args.channel !== undefined) {
      this.logger.verbose(`Adding Channel Creation for Swap: ${id}`);

      await this.channelCreationRepository.addChannelCreation({
        swapId: id,
        private: args.channel.private,
        type: args.channel.auto ? ChannelCreationType.Auto : ChannelCreationType.Create,
        inboundLiquidity: args.channel.inboundLiquidity,
      });
    }

    this.logger.verbose('swapmanager.300 createswap returning: ' + JSON.stringify({
      id,
      address,
      claimAddress,
      timeoutBlockHeight,
      // redeemScript,
      redeemScript: redeemScript ? getHexString(redeemScript) : undefined,
      // tokenAddress: tokenAddress ? tokenAddress : undefined,
    }));

    return {
      id,
      address,
      claimAddress,
      timeoutBlockHeight,
      // redeemScript,
      redeemScript: redeemScript ? getHexString(redeemScript) : undefined,
      // tokenAddress: tokenAddress ? tokenAddress : undefined,
      asTimeoutBlockHeight,
    };
  }

  /**
   * Sets the invoice of a Submarine Swap
   *
   * @param swap database object of the swap
   * @param invoice invoice of the Swap
   * @param expectedAmount amount that is expected onchain
   * @param percentageFee fee Boltz charges for the Swap
   * @param acceptZeroConf whether 0-conf transactions should be accepted
   * @param emitSwapInvoiceSet method to emit an event after the invoice has been set
   */
  public setSwapInvoice = async (
    swap: Swap,
    invoice: string,
    expectedAmount: number,
    percentageFee: number,
    acceptZeroConf: boolean,
    emitSwapInvoiceSet: (id: string) => void,
  ): Promise<SetSwapInvoiceResponse> => {
    const response: SetSwapInvoiceResponse = {};

    const { base, quote } = splitPairId(swap.pair);
    const { sendingCurrency, receivingCurrency } = this.getCurrencies(base, quote, swap.orderSide);

    const decodedInvoice = decodeInvoice(invoice);

    if (decodedInvoice.paymentHash !== swap.preimageHash) {
      throw Errors.INVOICE_INVALID_PREIMAGE_HASH(swap.preimageHash);
    }

    const invoiceExpiry = InvoiceExpiryHelper.getInvoiceExpiry(decodedInvoice.timestamp, decodedInvoice.timeExpireDate);

    if (getUnixTime() >= invoiceExpiry) {
      throw Errors.INVOICE_EXPIRED_ALREADY();
    }

    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });

    if (channelCreation) {
      const getChainInfo = async (currency: Currency): Promise<{ blocks: number, blockTime: number }> => {
        if (currency.type === CurrencyType.BitcoinLike) {
          const { blocks } = await currency.chainClient!.getBlockchainInfo();

          return {
            blocks,
            blockTime: TimeoutDeltaProvider.blockTimes.get(currency.symbol)!,
          };

        // TODO if RBTC -> channel
        // All currencies that are not Bitcoin-like are either Ether or an ERC20 token on the Ethereum chain
        } else {
          return {
            blocks: await currency.provider!.getBlockNumber(),
            blockTime: TimeoutDeltaProvider.blockTimes.get('ETH')!,
          };
        }
      };

      const { blocks, blockTime } = await getChainInfo(receivingCurrency);
      const blocksUntilExpiry = swap.timeoutBlockHeight - blocks;

      const timeoutTimestamp = getUnixTime() + (blocksUntilExpiry * blockTime * 60);

      const invoiceError = Errors.INVOICE_EXPIRES_TOO_EARLY(invoiceExpiry, timeoutTimestamp);

      if (timeoutTimestamp > invoiceExpiry) {
        // In the auto Channel Creation mode, which is used by the frontend, the invoice check can fail but the Swap should
        // still be attempted without Channel Creation
        if (channelCreation.type === ChannelCreationType.Auto) {
          this.logger.info(`Disabling Channel Creation for Swap ${swap.id}: ${invoiceError.message}`);
          response.channelCreationError = invoiceError.message;

          await channelCreation.destroy();

          if (!await this.checkRoutability(sendingCurrency.lndClient!, invoice)) {
            throw Errors.NO_ROUTE_FOUND();
          }

          // In other modes (only manual right now), a failing invoice Check should result in a failed request
        } else {
          throw invoiceError;
        }
      }

      await this.channelCreationRepository.setNodePublicKey(channelCreation, decodedInvoice.payeeNodeKey!);

    // If there are route hints the routability check could fail although LND could pay the invoice
    } else if (!decodedInvoice.routingInfo || (decodedInvoice.routingInfo && decodedInvoice.routingInfo.length === 0)) {
      if (!await this.checkRoutability(sendingCurrency.lndClient!, invoice)) {
        throw Errors.NO_ROUTE_FOUND();
      }
    }

    const previousStatus = swap.status;

    this.logger.debug(`Setting invoice of Swap ${swap.id}: ${invoice}`);
    const updatedSwap = await this.swapRepository.setInvoice(swap, invoice, expectedAmount, percentageFee, acceptZeroConf);

    // Not the most elegant way to emit this event but the only option
    // to emit it before trying to claim the swap
    emitSwapInvoiceSet(updatedSwap.id);

    // If the onchain coins were sent already and 0-conf can be accepted or
    // the lockup transaction is confirmed the swap should be settled directly
    if (swap.lockupTransactionId && previousStatus !== SwapUpdateEvent.TransactionZeroConfRejected) {
      try {
        await this.nursery.attemptSettleSwap(
          receivingCurrency,
          updatedSwap,
        );
      } catch (error) {
        this.logger.warn(`Could not settle Swap ${swap.id}: ${formatError(error)}`);
      }
    }

    return response;
  }

  /**
   * Creates a new reverse Swap from Lightning to the chain
   */
  public createReverseSwap = async (args: {
    baseCurrency: string,
    quoteCurrency: string,
    orderSide: OrderSide,
    preimageHash: Buffer,
    holdInvoiceAmount: number,
    onchainAmount: number,
    onchainTimeoutBlockDelta: number,
    lightningTimeoutBlockDelta: number,
    percentageFee: number,

    prepayMinerFeeInvoiceAmount?: number,
    prepayMinerFeeOnchainAmount?: number,

    // Public key of the node for which routing hints should be included in the invoice(s)
    routingNode?: string,

    // Only required for Swaps to UTXO based chains
    claimPublicKey?: Buffer,

    // Only required for Swaps to Ether and ERC20 tokens
    // Address of the user to which the coins will be sent after a successful claim transaction
    claimAddress?: string,
  }): Promise<{
    id: string,
    timeoutBlockHeight: number,

    invoice: string,
    minerFeeInvoice: string | undefined,

    // Only set for Bitcoin like, UTXO based, chains
    redeemScript: string | undefined,

    // Only set for Ethereum like chains
    refundAddress: string | undefined,

    // This is either the generated address for Bitcoin like chains, or the address of the contract
    // to which Boltz will send the lockup transaction for Ether and ERC20 tokens
    lockupAddress: string,
  }> => {
    const { sendingCurrency, receivingCurrency } = this.getCurrencies(args.baseCurrency, args.quoteCurrency, args.orderSide);

    if (!receivingCurrency.lndClient) {
      throw Errors.NO_LND_CLIENT(receivingCurrency.symbol);
    }

    const id = generateId();

    this.logger.verbose(`Creating new Reverse Swap from ${receivingCurrency.symbol} to ${sendingCurrency.symbol}: ${id}`);

    const routingHints = args.routingNode !== undefined ?
      this.routingHints.getRoutingHints(receivingCurrency.symbol, args.routingNode) :
      undefined;

    const { paymentRequest } = await receivingCurrency.lndClient.addHoldInvoice(
      args.holdInvoiceAmount,
      args.preimageHash,
      args.lightningTimeoutBlockDelta,
      this.invoiceExpiryHelper.getExpiry(receivingCurrency.symbol),
      getSwapMemo(sendingCurrency.symbol, true),
      routingHints,
    );

    receivingCurrency.lndClient.subscribeSingleInvoice(args.preimageHash);

    let minerFeeInvoice: string | undefined = undefined;
    let minerFeeInvoicePreimage: string | undefined = undefined;

    if (args.prepayMinerFeeInvoiceAmount) {
      const preimage = randomBytes(32);
      minerFeeInvoicePreimage = getHexString(preimage);

      const minerFeeInvoicePreimageHash = crypto.sha256(preimage);

      const prepayInvoice = await receivingCurrency.lndClient.addHoldInvoice(
        args.prepayMinerFeeInvoiceAmount,
        minerFeeInvoicePreimageHash,
        undefined,
        this.invoiceExpiryHelper.getExpiry(receivingCurrency.symbol),
        getPrepayMinerFeeInvoiceMemo(sendingCurrency.symbol),
        routingHints,
      );
      minerFeeInvoice = prepayInvoice.paymentRequest;

      receivingCurrency.lndClient.subscribeSingleInvoice(minerFeeInvoicePreimageHash);

      if (args.prepayMinerFeeOnchainAmount) {
        this.logger.debug(`Sending ${args.prepayMinerFeeOnchainAmount} Ether as prepay miner fee for Reverse Swap: ${id}`);
      }
    }

    const pair = getPairId({ base: args.baseCurrency, quote: args.quoteCurrency });

    let lockupAddress: string;
    let timeoutBlockHeight: number;

    let redeemScript: Buffer | undefined;

    let refundAddress: string | undefined;

    if (sendingCurrency.type === CurrencyType.BitcoinLike) {
      const { keys, index } = sendingCurrency.wallet.getNewKeys();
      const { blocks } = await sendingCurrency.chainClient!.getBlockchainInfo();
      timeoutBlockHeight = blocks + args.onchainTimeoutBlockDelta;

      redeemScript = reverseSwapScript(
        args.preimageHash,
        args.claimPublicKey!,
        keys.publicKey,
        timeoutBlockHeight,
      );

      const outputScript = getScriptHashFunction(ReverseSwapOutputType)(redeemScript);
      lockupAddress = sendingCurrency.wallet.encodeAddress(outputScript);

      await this.reverseSwapRepository.addReverseSwap({
        id,
        pair,
        lockupAddress,
        minerFeeInvoice,
        timeoutBlockHeight,

        keyIndex: index,
        fee: args.percentageFee,
        invoice: paymentRequest,
        orderSide: args.orderSide,
        onchainAmount: args.onchainAmount,
        status: SwapUpdateEvent.SwapCreated,
        redeemScript: getHexString(redeemScript),
        preimageHash: getHexString(args.preimageHash),
        minerFeeInvoicePreimage: minerFeeInvoicePreimage,
        minerFeeOnchainAmount: args.prepayMinerFeeOnchainAmount,
      });

    } else {
      // this.logger.error("swapmanager.515 " + sendingCurrency.provider!);
      // const blockNumber = await sendingCurrency.provider!.getBlockNumber();
      const info = await getInfo();
      const blockNumber = info.stacks_tip_height;
      timeoutBlockHeight = blockNumber + args.onchainTimeoutBlockDelta;

      lockupAddress = this.getLockupContractAddress(sendingCurrency.type, args.quoteCurrency);
      lockupAddress = lockupAddress.toLowerCase();

      refundAddress = await this.walletManager.wallets.get(sendingCurrency.symbol)!.getAddress();
      refundAddress = refundAddress.toLowerCase();

      this.logger.verbose('prepared reverse swap data: ' + blockNumber + ', ' + lockupAddress + ', ' + refundAddress);

      let tokenAddressHolder = Buffer.from('', 'utf8');
      if(sendingCurrency.type === CurrencyType.Sip10) {
        const tokenWallet = sendingCurrency.wallet.walletProvider as SIP10WalletProvider;
        tokenAddressHolder = Buffer.from(tokenWallet.getTokenContractAddress() + '.' + tokenWallet.getTokenContractName(), 'utf8');
        this.logger.debug('sm.599 setting redeemscript ' + sendingCurrency.type + ', ' + tokenAddressHolder);
        redeemScript = tokenAddressHolder;
      }

      await this.reverseSwapRepository.addReverseSwap({
        id,
        pair,
        lockupAddress,
        minerFeeInvoice,
        timeoutBlockHeight,

        fee: args.percentageFee,
        invoice: paymentRequest,
        orderSide: args.orderSide,
        claimAddress: args.claimAddress!,
        onchainAmount: args.onchainAmount,
        status: SwapUpdateEvent.SwapCreated,
        preimageHash: getHexString(args.preimageHash),
        minerFeeInvoicePreimage: minerFeeInvoicePreimage,
        minerFeeOnchainAmount: args.prepayMinerFeeOnchainAmount,
      });
    }

    return {
      id,
      lockupAddress,
      refundAddress,
      minerFeeInvoice,
      timeoutBlockHeight,
      invoice: paymentRequest,
      redeemScript: redeemScript ? getHexString(redeemScript) : undefined,
    };
  }

  // TODO: check current status of invoices or do the streams handle that already?
  private recreateFilters = (swaps: Swap[] | ReverseSwap[], isReverse: boolean) => {
    swaps.forEach((swap: Swap | ReverseSwap) => {
      const { base, quote } = splitPairId(swap.pair);
      const chainCurrency = getChainCurrency(base, quote, swap.orderSide, isReverse);
      const lightningCurrency = getLightningCurrency(base, quote, swap.orderSide, isReverse);

      if ((swap.status === SwapUpdateEvent.SwapCreated || swap.status === SwapUpdateEvent.MinerFeePaid) && isReverse) {
        this.logger.info('swapmanager recreateFilters foreach SwapCreated chainCurrency ' + chainCurrency);
        const reverseSwap = swap as ReverseSwap;

        const { lndClient } = this.currencies.get(lightningCurrency)!;

        if (reverseSwap.minerFeeInvoice && swap.status !== SwapUpdateEvent.MinerFeePaid) {
          lndClient!.subscribeSingleInvoice(getHexBuffer(decodeInvoice(reverseSwap.minerFeeInvoice).paymentHash!));
        }

        lndClient!.subscribeSingleInvoice(getHexBuffer(decodeInvoice(reverseSwap.invoice).paymentHash!));

      } else if ((swap.status === SwapUpdateEvent.TransactionMempool || swap.status === SwapUpdateEvent.TransactionConfirmed) && isReverse) {
        const { chainClient } = this.currencies.get(chainCurrency)!;

        if (chainClient) {
          this.logger.info('swapmanager recreateFilters foreach TransactionConfirmed chainCurrency ' + chainCurrency);
          const transactionId = reverseBuffer(getHexBuffer((swap as ReverseSwap).transactionId!));
          chainClient.addInputFilter(transactionId);

          // To detect when the transaction confirms
          if (swap.status === SwapUpdateEvent.TransactionMempool) {
            const wallet = this.walletManager.wallets.get(chainCurrency)!;
            chainClient.addOutputFilter(wallet.decodeAddress(swap.lockupAddress));
          }
        }
      } else {
        const { chainClient } = this.currencies.get(chainCurrency)!;

        if (chainClient) {
          this.logger.info('swapmanager recreateFilters foreach else chainCurrency ' + chainCurrency);
          const wallet = this.walletManager.wallets.get(chainCurrency)!;
          const outputScript = wallet.decodeAddress(swap.lockupAddress);

          chainClient.addOutputFilter(outputScript);
        }
      }
    });
  }

  /**
   * @returns whether the payment can be routed
   */
  private checkRoutability = async (lnd: LndClient, invoice: string) => {
    try {
      // TODO: do MPP probing once it is available
      const decodedInvoice = await lnd.decodePayReq(invoice);

      // Check whether the the receiving side supports MPP and if so,
      // query a route for the number of sats of the invoice divided
      // by the max payment parts we tell to LND to use
      const holder:any = decodedInvoice.featuresMap['17'];
      const amountToQuery = holder?.is_known ?
        Math.round(decodedInvoice.numSatoshis / LndClient.paymentMaxParts) :
        decodedInvoice.numSatoshis;

      const routes = await lnd.queryRoutes(decodedInvoice.destination, amountToQuery);

      // TODO: "routes.routesList.length >= LndClient.paymentParts" when receiver supports MPP?
      return routes.routesList.length > 0;
    } catch (error) {
      this.logger.debug(`Could not query routes: ${error}`);
      return false;
    }
  }

  private getCurrencies = (baseCurrency: string, quoteCurrency: string, orderSide: OrderSide) => {
    const { sending, receiving } = getSendingReceivingCurrency(baseCurrency, quoteCurrency, orderSide);
    // this.logger.error("swapmanager.668 " + stringify({
    //   // sendingCurrency: {
    //   //   ...this.getCurrency(sending),
    //   //   wallet: this.walletManager.wallets.get(sending)!,
    //   // },
    //   receivingCurrency: {
    //     ...this.getCurrency(receiving),
    //     wallet: this.walletManager.wallets.get(receiving)!,
    //   },
    // }));

    return {
      sendingCurrency: {
        ...this.getCurrency(sending),
        wallet: this.walletManager.wallets.get(sending)!,
      },
      receivingCurrency: {
        ...this.getCurrency(receiving),
        wallet: this.walletManager.wallets.get(receiving)!,
      },
    };
  }

  private getCurrency = (currencySymbol: string) => {
    const currency = this.currencies.get(currencySymbol);
    
    if (!currency) {
      // console.log("swapmanager.ts line 638");
      throw Errors.CURRENCY_NOT_FOUND(currencySymbol).message;
    }

    return currency;
  }

  private getLockupContractAddress = (type: CurrencyType, quoteCurrency: string): string => {
    this.logger.verbose('getLockupContractAddress CurrencyType: ' + type);
    const ethereumManager = this.walletManager.ethereumManager!;
    const rskManager = this.walletManager.rskManager!;
    const stacksManager = this.walletManager.stacksManager!;

    let addresstoreturn: string;
    if (type === CurrencyType.Ether) {
      addresstoreturn = ethereumManager.etherSwap.address;
    } else if (type === CurrencyType.Rbtc) {
      addresstoreturn = rskManager.etherSwap.address;
    } else if (type === CurrencyType.Stx) {
      addresstoreturn = stacksManager.stxswapaddress;
    } else if (type === CurrencyType.Sip10) {
      addresstoreturn = stacksManager.sip10SwapAddress;
    } else {
      console.log('getLockupContractAddress ', quoteCurrency);
      addresstoreturn = 'dummyvalue';
      // if (quoteCurrency == "SOV") {
      //   this.logger.error("getlockupcontractaddress from rsk");
      //   addresstoreturn = rskManager.erc20Swap.address;
      // } else {
      //   addresstoreturn = ethereumManager.erc20Swap.address;
      // }
    }

    return addresstoreturn;

    // return type === CurrencyType.Ether ? ethereumManager.etherSwap.address: ethereumManager.erc20Swap.address;
  }
}

export default SwapManager;
export { ChannelCreationInfo };
