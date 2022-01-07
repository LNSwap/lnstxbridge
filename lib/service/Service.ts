import { Op } from 'sequelize';
import { utils } from 'ethers';
import { OutputType } from 'boltz-core';
import { Transaction } from 'bitcoinjs-lib';
import Errors from './Errors';
import Logger from '../Logger';
import Swap from '../db/models/Swap';
import ApiErrors from '../api/Errors';
import Wallet from '../wallet/Wallet';
import { ConfigType } from '../Config';
import EventHandler from './EventHandler';
import { PairConfig } from '../consts/Types';
import PairRepository from '../db/PairRepository';
import DirectSwapRepository from '../db/DirectSwapRepository';
import { encodeBip21 } from './PaymentRequestUtils';
import InvoiceExpiryHelper from './InvoiceExpiryHelper';
import { Payment, RouteHint } from '../proto/lnd/rpc_pb';
import TimeoutDeltaProvider from './TimeoutDeltaProvider';
import { Network } from '../wallet/ethereum/EthereumManager';
import RateProvider, { PairType } from '../rates/RateProvider';
import { getGasPrice } from '../wallet/ethereum/EthereumUtils';
import { calculateStxOutTx, getAddressAllBalances, getFee, getInfo, getStacksRawTransaction, mintNFTforUser } from '../wallet/stacks/StacksUtils';
import WalletManager, { Currency } from '../wallet/WalletManager';
import SwapManager, { ChannelCreationInfo } from '../swap/SwapManager';
import { etherDecimals, ethereumPrepayMinerFeeGasLimit, gweiDecimals } from '../consts/Consts';
import { BaseFeeType, CurrencyType, OrderSide, ServiceInfo, ServiceWarning, SwapUpdateEvent } from '../consts/Enums';
import {
  Balance,
  ChainInfo,
  CurrencyInfo,
  DeriveKeysResponse,
  GetBalanceResponse,
  GetInfoResponse,
  LightningBalance,
  LndChannels,
  LndInfo,
  WalletBalance,
} from '../proto/boltzrpc_pb';
import {
  decodeInvoice,
  formatError,
  generateId,
  getChainCurrency,
  getHexBuffer,
  getHexString,
  getLightningCurrency,
  getPairId,
  getRate,
  getSendingReceivingCurrency,
  getSwapMemo,
  getUnixTime,
  getVersion,
  reverseBuffer,
  splitPairId,
} from '../Utils';

import mempoolJS from "@mempool/mempool.js";
const { bitcoin: { transactions } } = mempoolJS({
  hostname: 'mempool.space'
});

// increase listenerlimit
require('events').EventEmitter.defaultMaxListeners = 100;

type LndNodeInfo = {
  nodeKey: string,
  uris: string[],
};

class Service {

  public allowReverseSwaps = true;

  public swapManager: SwapManager;
  public eventHandler: EventHandler;

  private prepayMinerFee: boolean;

  private pairRepository: PairRepository;
  private directSwapRepository: DirectSwapRepository;

  private timeoutDeltaProvider: TimeoutDeltaProvider;

  private readonly rateProvider: RateProvider;

  private static MinInboundLiquidity = 10;
  private static MaxInboundLiquidity = 50;

  private serviceInvoiceListener;

  constructor(
    private logger: Logger,
    config: ConfigType,
    private walletManager: WalletManager,
    public currencies: Map<string, Currency>,
  ) {
    this.prepayMinerFee = config.prepayminerfee;
    this.logger.debug(`Prepay miner fee for Reverse Swaps is ${this.prepayMinerFee ? 'enabled' : 'disabled' }`);

    this.pairRepository = new PairRepository();
    this.directSwapRepository = new DirectSwapRepository();
    this.timeoutDeltaProvider = new TimeoutDeltaProvider(this.logger, config);

    console.log('service.ts 88');
    this.rateProvider = new RateProvider(
      this.logger,
      config.rates.interval,
      currencies,
      this.getFeeEstimation,
    );

    this.logger.debug(`Using ${config.swapwitnessaddress ? 'P2WSH' : 'P2SH nested P2WSH'} addresses for Submarine Swaps`);

    // this.logger.error('starting swapmanager inside service from Boltz');
    this.swapManager = new SwapManager(
      this.logger,
      this.walletManager,
      this.rateProvider,
      new InvoiceExpiryHelper(config.currencies),
      config.swapwitnessaddress ? OutputType.Bech32 : OutputType.Compatibility,
      config.retryInterval,
    );

    // this.logger.error(`starting EventHandler inside service from Boltz for ${this.currencies}` + JSON.stringify(Array.from(this.currencies)) + " " + currencies);
    this.eventHandler = new EventHandler(
      this.logger,
      this.currencies,
      this.swapManager.nursery,
    );
  }

  public init = async (configPairs: PairConfig[]): Promise<void> => {
    // console.log("***service.ts init");
    const dbPairSet = new Set<string>();
    const dbPairs = await this.pairRepository.getPairs();

    dbPairs.forEach((dbPair) => {
      dbPairSet.add(dbPair.id);
    });

    const checkCurrency = (symbol: string) => {
      if (!this.currencies.has(symbol)) {
        // console.log("service.ts line 123");
        throw Errors.CURRENCY_NOT_FOUND(symbol);
      }
    };

    for (const configPair of configPairs) {
      const id = getPairId(configPair);

      checkCurrency(configPair.base);
      checkCurrency(configPair.quote);

      if (!dbPairSet.has(id)) {
        await this.pairRepository.addPair({
          id,
          ...configPair,
        });
        this.logger.silly(`Added pair to database: ${id}`);
      }
    }
    
    this.logger.verbose('Updated pairs in the database');

    this.timeoutDeltaProvider.init(configPairs);

    this.rateProvider.feeProvider.init(configPairs);
    await this.rateProvider.init(configPairs);

    this.startNFTListener();
  }

  /**
   * Gets general information about this Boltz instance and the nodes it is connected to
   */
  public getInfo = async (): Promise<GetInfoResponse> => {
    this.logger.error('service.160 STARTED');
    const response = new GetInfoResponse();
    const map = response.getChainsMap();

    response.setVersion(getVersion());

    this.logger.error('service.165 - ' + JSON.stringify(this.currencies));
    for (const [symbol, currency] of this.currencies) {
      const chain = new ChainInfo();
      const lnd = new LndInfo();

      if (currency.chainClient) {
        try {
          const networkInfo = await currency.chainClient.getNetworkInfo();
          const blockchainInfo = await currency.chainClient.getBlockchainInfo();

          chain.setVersion(networkInfo.version);
          chain.setConnections(networkInfo.connections);

          chain.setBlocks(blockchainInfo.blocks);
          chain.setScannedBlocks(blockchainInfo.scannedBlocks);
        } catch (error) {
          chain.setError(formatError(error));
        }
      } else if (currency.provider) {
        try {
          const blockNumber = await currency.provider.getBlockNumber();

          chain.setBlocks(blockNumber);
          chain.setScannedBlocks(blockNumber);
        } catch (error) {
          chain.setError(formatError(error));
        }
      } else if (currency.stacksClient) {
        this.logger.error('service.ts 192 TODO');
        const blockNumber = await getInfo();
        this.logger.error('blockNumber: ' + blockNumber);
      }

      if (currency.lndClient) {
        try {
          const lndInfo = await currency.lndClient.getInfo();

          const channels = new LndChannels();

          channels.setActive(lndInfo.numActiveChannels);
          channels.setInactive(lndInfo.numInactiveChannels);
          channels.setPending(lndInfo.numPendingChannels);

          lnd.setLndChannels(channels);

          lnd.setVersion(lndInfo.version);
          lnd.setBlockHeight(lndInfo.blockHeight);
        } catch (error) {
          lnd.setError(error.details);
        }
      }

      const currencyInfo = new CurrencyInfo();
      currencyInfo.setChain(chain);
      currencyInfo.setLnd(lnd);

      map.set(symbol, currencyInfo);
    }

    return response;
  }

  /**
   * Gets the balance for either all wallets or just a single one if specified
   */
  public getBalance = async (): Promise<GetBalanceResponse> => {
    const response = new GetBalanceResponse();
    const map = response.getBalancesMap();

    const getBalance = async (symbol: string, wallet: Wallet) => {
      const balance = new Balance();
      const walletObject = new WalletBalance();

      const walletBalance = await wallet.getBalance();

      walletObject.setTotalBalance(walletBalance.totalBalance);
      walletObject.setConfirmedBalance(walletBalance.confirmedBalance);
      walletObject.setUnconfirmedBalance(walletBalance.unconfirmedBalance);

      balance.setWalletBalance(walletObject);

      const currencyInfo = this.currencies.get(symbol);

      if (currencyInfo && currencyInfo.lndClient) {
        const lightningBalance = new LightningBalance();

        const { channelsList } = await currencyInfo.lndClient.listChannels();

        let localBalance = 0;
        let remoteBalance = 0;

        channelsList.forEach((channel) => {
          localBalance += channel.localBalance;
          remoteBalance += channel.remoteBalance;
        });

        lightningBalance.setLocalBalance(localBalance);
        lightningBalance.setRemoteBalance(remoteBalance);

        balance.setLightningBalance(lightningBalance);
      }

      return balance;
    };

    for (const [symbol, wallet] of this.walletManager.wallets) {
      map.set(symbol, await getBalance(symbol, wallet));
    }

    return response;
  }

  /**
   * Gets all supported pairs and their conversion rates
   */
  public getPairs = (): {
    info: ServiceInfo[],
    warnings: ServiceWarning[],
    pairs: Map<string, PairType>,
  } => {
    const info: ServiceInfo[] = [];
    const warnings: ServiceWarning[] = [];

    if (this.prepayMinerFee) {
      info.push(ServiceInfo.PrepayMinerFee);
    }

    if (!this.allowReverseSwaps) {
      warnings.push(ServiceWarning.ReverseSwapsDisabled);
    }

    return {
      info,
      warnings,
      pairs: this.rateProvider.pairs,
    };
  }

  /**
   * Gets a map between the LND node keys and URIs and the symbol of the chains they are running on
   */
  public getNodes = async (): Promise<Map<string, LndNodeInfo>> => {
    const response = new Map<string, LndNodeInfo>();

    for (const [symbol, currency] of this.currencies) {
      if (currency.lndClient) {
        const lndInfo = await currency.lndClient.getInfo();
        response.set(symbol, {
          uris: lndInfo.urisList,
          nodeKey: lndInfo.identityPubkey,
        });
      }
    }

    return response;
  }

  public getRoutingHints = (symbol: string, routingNode: string): RouteHint.AsObject[] => {
    const response: RouteHint.AsObject[] = [];

    const hints = this.swapManager.routingHints.getRoutingHints(symbol, routingNode);
    hints.forEach((hint) => response.push(hint.toObject()));

    return response;
  }

  /**
   * Gets the contract address used by the Boltz instance
   */
  public getContracts = (): {
    ethereum: {
      network: Network,
      swapContracts: Map<string, string>,
      tokens: Map<string, string>,
    },
    rsk: {
      network: Network,
      swapContracts: Map<string, string>,
      tokens: Map<string, string>,
    },
  } => {
    if (this.walletManager.ethereumManager === undefined) {
      throw Errors.ETHEREUM_NOT_ENABLED();
    }
    if (this.walletManager.rskManager === undefined) {
      throw Errors.RSK_NOT_ENABLED();
    }

    return {
      ethereum: {
        network: this.walletManager.ethereumManager.network,
        tokens: this.walletManager.ethereumManager.tokenAddresses,
        swapContracts: new Map<string, string>([
          ['EtherSwap', this.walletManager.ethereumManager.etherSwap.address],
          ['ERC20Swap', this.walletManager.ethereumManager.erc20Swap.address],
        ]),
      },
      rsk: {
        network: this.walletManager.rskManager.network,
        tokens: this.walletManager.rskManager.tokenAddresses,
        swapContracts: new Map<string, string>([
          ['RbtcSwap', this.walletManager.rskManager.etherSwap.address],
          ['ERC20Swap', this.walletManager.rskManager.erc20Swap.address],
        ]),
      },
    };
  }

  /**
   * Gets a hex encoded transaction from a transaction hash on the specified network
   */
  public getTransaction = async (symbol: string, transactionHash: string): Promise<string> => {
    const currency = this.getCurrency(symbol);

    if (currency.chainClient === undefined) {
      // this.logger.error("service.381 gettransaction " + currency.stacksClient)
      if(currency.stacksClient !== undefined) {
        // this.logger.error("service.383 gettransaction ")
        return await getStacksRawTransaction(transactionHash);
      } else {
        console.log('service.381 NOT_SUPPORTED_BY_SYMBOL');
        throw Errors.NOT_SUPPORTED_BY_SYMBOL(symbol);
      }
    }

    // need blockhash because we're running a pruned node with no -txindex
    if((await getInfo()).network_id === 1) {
      const mempoolTx = await transactions.getTx({ txid: transactionHash });
      return await currency.chainClient.getRawTransactionBlockHash(transactionHash, mempoolTx.status.block_hash);
    } else {
      // regtest
      return await currency.chainClient.getRawTransaction(transactionHash);
    }
    
    // return await currency.chainClient.getRawTransaction(transactionHash);
  }

  /**
   * Gets the hex encoded lockup transaction of a Submarine Swap, the block height
   * at which it will timeout and the expected ETA for that block
   */
  public getSwapTransaction = async (id: string): Promise<{
    transactionHex: string,
    timeoutBlockHeight: number,
  }> => {
    const swap = await this.swapManager.swapRepository.getSwap({
      id: {
        [Op.eq]: id,
      },
    });

    if (!swap) {
      throw Errors.SWAP_NOT_FOUND(id);
    }

    if (!swap.lockupTransactionId) {
      throw Errors.SWAP_NO_LOCKUP();
    }

    const { base, quote } = splitPairId(swap.pair);
    const chainCurrency = getChainCurrency(base, quote, swap.orderSide, false);

    const currency = this.getCurrency(chainCurrency);

    if (currency.chainClient === undefined) {
      console.log('service.ts 408 NOT_SUPPORTED_BY_SYMBOL');
      throw Errors.NOT_SUPPORTED_BY_SYMBOL(currency.symbol);
    }

    const { blocks } = await currency.chainClient.getBlockchainInfo();
    const transactionHex = await currency.chainClient.getRawTransaction(swap.lockupTransactionId);

    const response: any = {
      transactionHex,
    };

    response.timeoutBlockHeight = swap.timeoutBlockHeight;

    if (blocks < swap.timeoutBlockHeight) {
      response.timeoutEta = this.calculateTimeoutDate(chainCurrency, swap.timeoutBlockHeight - blocks);
    }

    return response;
  }

  public deriveKeys = (symbol: string, index: number): DeriveKeysResponse => {
    const wallet = this.walletManager.wallets.get(symbol.toUpperCase());

    if (wallet === undefined) {
      console.log('service.ts line 411');
      throw Errors.CURRENCY_NOT_FOUND(symbol);
    }

    const keys = wallet.getKeysByIndex(index);

    const response = new DeriveKeysResponse();

    response.setPublicKey(getHexString(keys.publicKey));
    response.setPrivateKey(getHexString(keys.privateKey!));

    return response;
  }

  /**
   * Gets an address of a specified wallet
   */
  public getAddress = async (symbol: string): Promise<string> => {
    const wallet = this.walletManager.wallets.get(symbol);

    if (wallet !== undefined) {
      return wallet.getAddress();
    }
    console.log('service.ts line 434');
    throw Errors.CURRENCY_NOT_FOUND(symbol);
  }

  /**
   * Gets a fee estimation in satoshis per vbyte or GWEI for either all currencies or just a single one if specified
   */
  public getFeeEstimation = async (symbol?: string, blocks?: number): Promise<Map<string, number>> => {
    const map = new Map<string, number>();

    const numBlocks = blocks === undefined ? 2 : blocks;

    const estimateFee = async (currency: Currency): Promise<number> => {
      // console.log("service.ts 468 ", currency);
      if (currency.chainClient) {
        // let test = await currency.chainClient.estimateFee(numBlocks)
        // this.logger.error("service.478 btc chainclient estimatefee: "+ test)
        return currency.chainClient.estimateFee(numBlocks);
      } else if (currency.provider) {
        const gasPrice = await getGasPrice(currency.provider);
        return gasPrice.div(gweiDecimals).toNumber();
      } else if (currency.stacksClient) {
        // STACKS I do it manually differently.
        const fee = await getFee();
        // this.logger.error("service.485 got fee: " + fee + ", gweiDecimals " + gweiDecimals)
        // // fee = fee / BigInt(gweiDecimals)
        // // fee = new BigNumber(fee).toNumber().div(gweiDecimals).toNumber()
        // this.logger.error("service.487 fee.div: " + fee)
        // const test = await getTest();
        // console.log("fee, test ", fee, test)
        // console.log("NEED TO GET GAS FEE from STACKS CLIENT!!!", fee)
        // return fee;
        // const gasPrice = await getGasPrice(currency.provider);
        return fee.div(gweiDecimals).toNumber();

      } else {
        console.log('service.ts 475 NOT_SUPPORTED_BY_SYMBOL');
        throw Errors.NOT_SUPPORTED_BY_SYMBOL(currency.symbol);
      }
    };

    if (symbol !== undefined) {
      // console.log("service.ts 489 ", symbol)
      const currency = this.getCurrency(symbol);
      const isERC20 = currency.type === CurrencyType.ERC20;
      // const isRBTC = currency.type === CurrencyType.Rbtc;

      // if(!isERC20 && isRBTC) {

      // } else if ()

      // map.set(isRBTC ? 'RBTC' : symbol, await estimateFee(currency));
      // this.logger.error("getFeeEstimation: " + currency.symbol + ", isERC20" + isERC20 + ", isRBTC" +isRBTC + ", map.set" + (isERC20 ? 'ETH' : symbol));

      // already works for rbtc
      // console.log("service.ts 502 ", isERC20 ? 'ETH' : symbol, currency)
      map.set(isERC20 ? 'ETH' : symbol, await estimateFee(currency));
    } else {
      for (const [symbol, currency] of this.currencies) {
        if (currency.type === CurrencyType.ERC20) {
          if (!map.has('ETH')) {
            console.log('service.ts 507 estimateFee', currency);
            map.set('ETH', await estimateFee(currency));
          }

          continue;
        }
        console.log('service.ts 513 estimateFee ', currency.symbol);
        map.set(symbol, await estimateFee(currency));
      }
    }

    return map;
  }

  /**
   * Broadcast a hex encoded transaction on the specified network
   */
  public broadcastTransaction = async (symbol: string, transactionHex: string): Promise<string> => {
    const currency = this.getCurrency(symbol);

    if (currency.chainClient === undefined) {
      console.log('service.ts 518 NOT_SUPPORTED_BY_SYMBOL');
      throw Errors.NOT_SUPPORTED_BY_SYMBOL(symbol);
    }

    try {
      return await currency.chainClient.sendRawTransaction(transactionHex);
    } catch (error) {
      // This special error is thrown when a Submarine Swap that has not timed out yet is refunded
      // To improve the UX we will throw not only the error but also some additional information
      // regarding when the Submarine Swap can be refunded
      if (error.code === -26 && error.message.startsWith('non-mandatory-script-verify-flag (Locktime requirement not satisfied)')) {
        const refundTransaction = Transaction.fromHex(transactionHex);

        let swap: Swap | null | undefined;

        for (const input of refundTransaction.ins) {
          swap = await this.swapManager.swapRepository.getSwap({
            lockupTransactionId: {
              [Op.eq]: getHexString(reverseBuffer(input.hash)),
            },
          });

          if (swap) {
            break;
          }
        }

        if (!swap) {
          throw error;
        }

        const { blocks } = await currency.chainClient.getBlockchainInfo();

        throw {
          error: error.message,
          timeoutBlockHeight: swap.timeoutBlockHeight,
          // Here we don't need to check whether the Swap has timed out yet because
          // if the error above has been thrown, we can be sure that this is not the case
          timeoutEta: this.calculateTimeoutDate(symbol, swap.timeoutBlockHeight - blocks),
        };
      } else {
        throw error;
      }
    }
  }

  /**
   * Updates the timeout block delta of a pair
   */
  public updateTimeoutBlockDelta = (pairId: string, newDelta: number): void => {
    this.timeoutDeltaProvider.setTimeout(pairId, newDelta);

    this.logger.info(`Updated timeout block delta of ${pairId} to ${newDelta} minutes`);
  }

  /**
   * Creates a new Swap from the chain to Lightning
   */
  public createSwap = async (args: {
    pairId: string,
    orderSide: string,
    preimageHash: Buffer,
    channel?: ChannelCreationInfo,

    // Only required for UTXO based chains
    refundPublicKey?: Buffer,

    requestedAmount?: number,
    claimAddress?: string,
    quoteAmount?: number,
    baseAmount?: number,
    claimPublicKey?: string,
  }): Promise<{
    id: string,
    address: string,
    timeoutBlockHeight: number,

    // Is undefined when Ether or ERC20 tokens are swapped to Lightning
    redeemScript?: string,

    // Is undefined when Bitcoin or Litecoin is swapped to Lightning
    claimAddress?: string,

    // // for onchain swaps
    bip21?: string,
    expectedAmount?: number,
    acceptZeroConf?: boolean,
    contractAddress?: string,
    asTimeoutBlockHeight?: number,
    quoteAmount?: number,
    baseAmount?: number,
    tokenAddress?: string,
    origBlockHeight?: number,
  }> => {
    // console.log('Service.641 ARGS ', args);
    const swap = await this.swapManager.swapRepository.getSwap({
      preimageHash: {
        [Op.eq]: getHexString(args.preimageHash),
      },
    });

    if (swap) {
      throw Errors.SWAP_WITH_PREIMAGE_EXISTS();
    }

    const { base, quote } = this.getPair(args.pairId);
    const orderSide = this.getOrderSide(args.orderSide);

    switch (this.getCurrency(getChainCurrency(base, quote, orderSide, false)).type) {
      case CurrencyType.BitcoinLike:
        if (args.refundPublicKey === undefined) {
          throw ApiErrors.UNDEFINED_PARAMETER('refundPublicKey');
        }
        break;
    }

    if (args.channel) {
      if (args.channel.inboundLiquidity > Service.MaxInboundLiquidity) {
        throw Errors.EXCEEDS_MAX_INBOUND_LIQUIDITY(args.channel.inboundLiquidity, Service.MaxInboundLiquidity);
      }

      if (args.channel.inboundLiquidity < Service.MinInboundLiquidity) {
        throw Errors.BENEATH_MIN_INBOUND_LIQUIDITY(args.channel.inboundLiquidity, Service.MinInboundLiquidity);
      }
    }

    const timeoutBlockDelta = this.timeoutDeltaProvider.getTimeout(args.pairId, orderSide, false);

    const side = this.getOrderSide(args.orderSide);
    const onchainTimeoutBlockDelta = this.timeoutDeltaProvider.getTimeout(args.pairId, side, true);

    const {
      id,
      address,
      redeemScript,
      claimAddress,
      timeoutBlockHeight,
      asTimeoutBlockHeight,
      tokenAddress,
    } = await this.swapManager.createSwap({
      orderSide,
      timeoutBlockDelta,

      baseCurrency: base,
      quoteCurrency: quote,
      channel: args.channel,
      preimageHash: args.preimageHash,
      refundPublicKey: args.refundPublicKey,
      claimAddress: args.claimAddress,

      requestedAmount: args.requestedAmount,
      quoteAmount: args.quoteAmount,
      baseAmount: args.baseAmount,

      onchainTimeoutBlockDelta,
      // claimPublicKey: args.claimPublicKey, // this is keys.publickey coming from user = refundPublicKey
      // bip21,
      // expectedAmount,
      // acceptZeroConf,
    });

    let acceptZeroConf = true;
    let bip21 = '';
    let expectedAmount = 0;
    let contractAddress = '';
    let finalTimeoutBlockheight = timeoutBlockHeight;
    if (args.requestedAmount && args.orderSide == 'sell') {
      const response = await this.getManualRates(id, args.requestedAmount);
      console.log('service.688 getManualRates requestedAmount vs response ', args.requestedAmount, response);
      if(base !== 'BTC') {
        expectedAmount = response.onchainAmount || 0;
        console.log('base is NOT BTC so set expected = onchainamount ', expectedAmount);
      } else {
        expectedAmount = args.baseAmount || 0;
        console.log('base is BTC so set expected = args.baseAmount ', expectedAmount);
      }

      // verify client-side input
      if (args.quoteAmount && (args.requestedAmount != Math.floor(args.quoteAmount*10**6))) {
        console.log('s.730 VERIFICATION FAILED requestedAmount vs quoteAmount', args.requestedAmount, args.quoteAmount*10**6, args.requestedAmount !== args.quoteAmount*10**6);
        throw Errors.INVALID_PARAMETER()
      }
      if (expectedAmount < response.submarineSwap.invoiceAmount/10**8) {
        console.log('s.733 VERIFICATION FAILED expectedAmount (user will lock) vs invoiceAmount (operator will pay) ', expectedAmount, response.submarineSwap.invoiceAmount/10**8);
        throw Errors.WRONG_RATE()
      }      

      // acceptZeroConf = true;
      bip21 = encodeBip21(
        base,
        address,
        // expectedAmount,
        expectedAmount*10**8,
        'onchain swap',
        // getSwapMemo(quote, false),
      ) || '';

      acceptZeroConf = this.rateProvider.acceptZeroConf(base, expectedAmount);
      const swap = await this.swapManager.swapRepository.getSwap({
        id: {
          [Op.eq]: id,
        },
      });
      if (swap)
        await this.swapManager.swapRepository.setAcceptZeroConf(swap, acceptZeroConf);

      console.log('updated swap acceptZeroConf', base, expectedAmount, acceptZeroConf);

      contractAddress = swap?.contractAddress || '';

      // console.log('TODO:: validate base/quote amount!!!');//done

      // set timeout = astimeout for atomic swaps
      console.log('s.743 setting timeout=asTimeoutBlockHeight: ', asTimeoutBlockHeight);
      finalTimeoutBlockheight = asTimeoutBlockHeight!;
    } else if(args.baseAmount) {
      // verify client-side input
      const response = await this.getManualRates(id, args.baseAmount, true);
      console.log('s.770 response ', response);

      // console.log('TODO: more validation NEEDED'); //done
      if (response.onchainAmount && args.quoteAmount && (args.quoteAmount > response.onchainAmount/100)) {
        throw Errors.WRONG_RATE()
      }

    } else {
      console.log('s.777 no validation done');
    }

    this.eventHandler.emitSwapCreation(id);

    console.log('s.782 end returning this ', {
      bip21,
      expectedAmount,
      acceptZeroConf,
      id,
      address,
      redeemScript,
      claimAddress,
      timeoutBlockHeight: finalTimeoutBlockheight,
      contractAddress,
      asTimeoutBlockHeight,
      baseAmount: args.baseAmount,
      quoteAmount: args.quoteAmount,
      tokenAddress,
      origBlockHeight: timeoutBlockHeight
    });

    return {
      bip21,
      expectedAmount,
      acceptZeroConf,
      id,
      address,
      redeemScript,
      claimAddress,
      timeoutBlockHeight: finalTimeoutBlockheight,
      contractAddress,
      asTimeoutBlockHeight,
      baseAmount: args.baseAmount,
      quoteAmount: args.quoteAmount,
      tokenAddress,
      origBlockHeight: timeoutBlockHeight
    };
  }

  /**
   * Gets the rates for a Submarine Swap that has coins in its lockup address but no invoice yet
   */
  public getSwapRates = async (id: string): Promise<{
    onchainAmount: number,
    submarineSwap: {
      invoiceAmount: number,
    },
  }> => {
    const swap = await this.swapManager.swapRepository.getSwap({
      id: {
        [Op.eq]: id,
      },
    });

    if (!swap) {
      throw Errors.SWAP_NOT_FOUND(id);
    }

    if (!swap.onchainAmount) {
      throw Errors.SWAP_NO_LOCKUP();
    }

    const { base, quote } = splitPairId(swap.pair);
    const onchainCurrency = getChainCurrency(base, quote, swap.orderSide, false);

    const rate = getRate(swap.rate!, swap.orderSide, false);

    const percentageFee = this.rateProvider.feeProvider.getPercentageFee(swap.pair);
    const baseFee = this.rateProvider.feeProvider.getBaseFee(onchainCurrency, BaseFeeType.NormalClaim);

    const invoiceAmount = this.calculateInvoiceAmount(swap.orderSide, rate, swap.onchainAmount, baseFee, percentageFee);

    this.verifyAmount(swap.pair, rate, invoiceAmount, swap.orderSide, false);

    console.log('service.733 getswaprates: ', {
      onchainAmount: swap.onchainAmount,
      submarineSwap: {
        invoiceAmount,
      }});

    return {
      onchainAmount: swap.onchainAmount,
      submarineSwap: {
        invoiceAmount,
      },
    };
  }

  /**
   * Sets the rate for a Swap that doesn't have an invoice yet
   */
    private setSwapRate = async (swap: Swap) => {
    if (!swap.rate) {
      const rate = getRate(
        this.rateProvider.pairs.get(swap.pair)!.rate,
        swap.orderSide,
        false
      );

      await this.setRate(swap, rate);
    }
  }
  public setRate = (swap: Swap, rate: number): Promise<Swap> => {
    return swap.update({
      rate,
    });
  }

  /**
   * Gets/Sets the rates for an Atomic Swap that user requested
   */
   public getManualRates = async (id: string, requestedAmount: number, skipVerify?: boolean): Promise<{
    requestedAmount?: number,
    onchainAmount?: number,
    submarineSwap: {
      invoiceAmount: number,
    },
    atomicSwap: {
      invoiceAmountAS: number,
    }
  }> => {
    const swap = await this.swapManager.swapRepository.getSwap({
      id: {
        [Op.eq]: id,
      },
    });

    if (!swap) {
      throw Errors.SWAP_NOT_FOUND(id);
    }

    await this.setSwapRate(swap);
    // if (!swap.onchainAmount) {
    //   throw Errors.SWAP_NO_LOCKUP();
    // }

    const { base, quote } = splitPairId(swap.pair);
    const onchainCurrency = getChainCurrency(base, quote, swap.orderSide, false);
    console.log('s.838 swap.rate swap.orderSide, base, quote', swap.rate, swap.orderSide, base, quote);

    const rate = getRate(swap.rate!, swap.orderSide, true);
    console.log('s.876 rate ', rate);

    const percentageFee = this.rateProvider.feeProvider.getPercentageFee(swap.pair);
    const baseFee = this.rateProvider.feeProvider.getBaseFee(onchainCurrency, BaseFeeType.NormalClaim);
    console.log('s.781 onchainCurrency, percentageFee, baseFee', onchainCurrency, percentageFee, baseFee);

    let onchainAmount, invoiceAmount, invoiceAmountAS;
    if ((swap.pair === 'BTC/STX' || swap.pair === 'BTC/USDA') && swap.orderSide === 1) {
      // requested amount is already in mstx
      onchainAmount = requestedAmount*100; //go from mstx -> boltz (10^8)
      invoiceAmount = this.calculateInvoiceAmount(swap.orderSide, rate, onchainAmount, baseFee, percentageFee);
      invoiceAmountAS = this.calculateInvoiceAmountAS(swap.orderSide, rate, onchainAmount, baseFee, percentageFee);
      console.log('s.872 onchainAmount=requestedAmount ', requestedAmount);
      console.log('s.873 invoiceAmount ', invoiceAmount);
      console.log('s.874 invoiceAmountAS ', invoiceAmountAS);

      this.verifyAmount(swap.pair, rate, invoiceAmount, swap.orderSide, false);

      // check that rate is acceptable
      if (this.catchRates((requestedAmount*rate)/10**6, invoiceAmountAS/10**8)) {
        throw Errors.WRONG_RATE();
      }

      console.log('s.899 ', 'user requested ', requestedAmount, ' stx/usda for ',  )

    } else {
      // requested amount in mstx
      onchainAmount = ((requestedAmount/1000000) * rate) * 100000000;
      console.log('s.810 requestedAmount, onchainAmount, swap.orderSide: ', requestedAmount, onchainAmount, swap.orderSide);

      invoiceAmount = this.calculateOnchainAmount(swap.orderSide, rate, onchainAmount, baseFee, percentageFee);
      console.log('s.784 requestedAmount, onchainAmount, invoiceAmount', requestedAmount, onchainAmount, invoiceAmount);

      

      // let originvoiceAmount = this.calculateInvoiceAmount(swap.orderSide, rate, onchainAmount, baseFee, percentageFee);
      // invoiceAmountAS = this.calculateInvoiceAmountAS(swap.orderSide, rate, onchainAmount, baseFee, percentageFee);
      // console.log('s.940 originvoiceAmount, invoiceAmountAS', originvoiceAmount, invoiceAmountAS)

      if(!skipVerify) {
        console.log('s.899 verifyAmount pair,rate,invoiceamount,orderside: ', swap.pair, 'rate', rate, 'invoiceamount', invoiceAmount, 'orderside', swap.orderSide);
        this.verifyAmount(swap.pair, rate, invoiceAmount, swap.orderSide, false);
      }

      // this is done in service.ts
      // // check that rate is acceptable should be within %1
      // if (this.catchRates((requestedAmount*rate)/10**6, invoiceAmount/10**8)){
      //   throw Errors.WRONG_RATE();
      // }
      
      console.log('s.902 getManualRates: ', {
        onchainAmount: swap.onchainAmount,
        submarineSwap: {
          invoiceAmount,
        },
        atomicSwap: {
          invoiceAmountAS,
        }});
    }

    return {
      requestedAmount,
      onchainAmount,
      submarineSwap: {
        invoiceAmount,
      },
      atomicSwap: {
        invoiceAmountAS,
      }
    };
  }

  /**
   * Validates exchange rates for atomic swaps because client-side data
   */
   public catchRates = (operatorSide: number, userSide: number): boolean => {
    // operatorSide = requestedAmount*rate - lnswap is sending this
    // userSide = invoiceAmount calculated in backend - lnswap is receiving this
    
    // Accept spread due to fees
    if (operatorSide*1.01 > userSide ) {
      console.log('s.940 caught rate issue');
      // 
      // || amountOne < amountTwo*0.97
      // throw Errors.WRONG_RATE();
      return true;
    } else {
      console.log('s.951 validateRates OK not bad rates ', operatorSide, userSide, operatorSide > userSide);
      return false;
    }

    // if (amountTwo > amountOne*1.03 || amountTwo < amountOne*0.97) {
    //   // throw Errors.WRONG_RATE();
    //   return false;
    // }

  };

  /**
   * Sets the invoice of Submarine Swap
   */
  public setSwapInvoice = async (id: string, invoice: string, pairHash?: string): Promise<{
    bip21: string,
    expectedAmount: number,
    acceptZeroConf: boolean,
  } | Record<string, any>> => {
    const swap = await this.swapManager.swapRepository.getSwap({
      id: {
        [Op.eq]: id,
      },
    });

    if (!swap) {
      throw Errors.SWAP_NOT_FOUND(id);
    }

    if (swap.invoice) {
      throw Errors.SWAP_HAS_INVOICE_ALREADY(id);
    }

    const { base, quote, rate: pairRate } = this.getPair(swap.pair);

    if (pairHash !== undefined) {
      this.validatePairHash(swap.pair, pairHash);
    }

    const chainCurrency = getChainCurrency(base, quote, swap.orderSide, false);
    const lightningCurrency = getLightningCurrency(base, quote, swap.orderSide, false);

    const invoiceAmount = decodeInvoice(invoice).satoshis!;
    const rate = swap.rate || getRate(pairRate, swap.orderSide, false);

    this.verifyAmount(swap.pair, rate, invoiceAmount, swap.orderSide, false);

    const { baseFee, percentageFee } = this.rateProvider.feeProvider.getFees(
      swap.pair,
      rate,
      swap.orderSide,
      invoiceAmount,
      BaseFeeType.NormalClaim,
    );
    const expectedAmount = Math.floor(invoiceAmount * rate) + baseFee + percentageFee;

    if (swap.onchainAmount && expectedAmount > swap.onchainAmount) {
      const maxInvoiceAmount = this.calculateInvoiceAmount(
        swap.orderSide,
        rate,
        swap.onchainAmount,
        baseFee,
        this.rateProvider.feeProvider.getPercentageFee(swap.pair),
      );

      throw Errors.INVALID_INVOICE_AMOUNT(maxInvoiceAmount);
    }

    const acceptZeroConf = this.rateProvider.acceptZeroConf(chainCurrency, expectedAmount);

    await this.swapManager.setSwapInvoice(
      swap,
      invoice,
      expectedAmount,
      percentageFee,
      acceptZeroConf,
      this.eventHandler.emitSwapInvoiceSet,
    );

    // The expected amount doesn't have to be returned if the onchain coins were sent already
    if (swap.lockupTransactionId) {
      return {};
    }

    return {
      expectedAmount,
      acceptZeroConf,
      bip21: encodeBip21(
        chainCurrency,
        swap.lockupAddress,
        expectedAmount,
        getSwapMemo(lightningCurrency, false),
      ),
    };
  }

  /**
   * Creates a Submarine Swap with an invoice
   *
   * This method combines "createSwap" and "setSwapInvoice"
   */
  public createSwapWithInvoice = async (
    pairId: string,
    orderSide: string,
    refundPublicKey: Buffer,
    invoice: string,
    pairHash?: string,
    channel?: ChannelCreationInfo,
  ): Promise<{
    id: string,
    bip21: string,
    address: string,
    expectedAmount: number,
    acceptZeroConf: boolean,
    timeoutBlockHeight: number,

    // Is undefined when Ether or ERC20 tokens are swapped to Lightning
    redeemScript?: string,

    // Is undefined when Bitcoin or Litecoin is swapped to Lightning
    claimAddress?: string,

    tokenAddress?: string,
  }> => {
    let swap = await this.swapManager.swapRepository.getSwap({
      invoice: {
        [Op.eq]: invoice,
      },
    });

    if (swap) {
      throw Errors.SWAP_WITH_INVOICE_EXISTS();
    }

    const preimageHash = getHexBuffer(decodeInvoice(invoice).paymentHash!);
    console.log('s.1010 createswapwithinvoice preimageHash = ', decodeInvoice(invoice).paymentHash!);

    const {
      id,
      address,
      claimAddress,
      redeemScript,
      timeoutBlockHeight,
      tokenAddress,
    } = await this.createSwap({
      pairId,
      channel,
      orderSide,
      preimageHash,
      refundPublicKey,
    });

    try {
      const {
        bip21,
        acceptZeroConf,
        expectedAmount,
      } = await this.setSwapInvoice(id, invoice, pairHash);

      return {
        id,
        bip21,
        address,
        claimAddress,
        redeemScript,
        acceptZeroConf,
        expectedAmount,
        timeoutBlockHeight,
        tokenAddress,
      };
    } catch (error) {
      const channelCreation = await this.swapManager.channelCreationRepository.getChannelCreation({
        swapId: {
          [Op.eq]: id,
        },
      });
      await channelCreation?.destroy();

      swap = await this.swapManager.swapRepository.getSwap({
        id: {
          [Op.eq]: id,
        },
      });
      await swap?.destroy();

      throw error;
    }
  }

  /**
   * Creates a new Swap from Lightning to the chain
   */
  public createReverseSwap = async (args: {
    pairId: string,
    pairHash?: string,
    orderSide: string,
    preimageHash: Buffer,

    invoiceAmount?: number,
    onchainAmount?: number,

    // Public key of the node for which routing hints should be included in the invoice(s)
    routingNode?: string,

    // Required for UTXO based chains
    claimPublicKey?: Buffer,

    // Required for Reverse Swaps to Ether or ERC20 tokens
    claimAddress?: string,

    // Whether the Ethereum prepay miner fee should be enabled for the Reverse Swap
    prepayMinerFee?: boolean,
  }): Promise<{
    id: string,
    invoice: string,
    redeemScript?: string,
    refundAddress?: string,
    lockupAddress: string,
    onchainAmount?: number,
    minerFeeInvoice?: string,
    timeoutBlockHeight: number,
    prepayMinerFeeAmount?: number,
  }> => {
    if (!this.allowReverseSwaps) {
      throw Errors.REVERSE_SWAPS_DISABLED();
    }

    const side = this.getOrderSide(args.orderSide);
    const { base, quote, rate: pairRate } = this.getPair(args.pairId);

    if (args.pairHash !== undefined) {
      this.validatePairHash(args.pairId, args.pairHash);
    }

    const { sending, receiving } = getSendingReceivingCurrency(base, quote, side);
    const sendingCurrency = this.getCurrency(sending);

    // Not the prettiest way and also not the right spot to do input validation but
    // only at this point in time the type of the sending currency is known
    this.logger.verbose('Service.956 sendingCurrency.type '+ JSON.stringify(sendingCurrency));
    switch (sendingCurrency.type) {
      case CurrencyType.BitcoinLike:
        if (args.claimPublicKey === undefined) {
          throw ApiErrors.UNDEFINED_PARAMETER('claimPublicKey');
        }

        if (args.prepayMinerFee === true) {
          throw ApiErrors.UNSUPPORTED_PARAMETER(sending, 'prepayMinerFee');
        }
        break;

      case CurrencyType.Ether:
      case CurrencyType.ERC20:
        if (args.claimAddress === undefined) {
          throw ApiErrors.UNDEFINED_PARAMETER('claimAddress');
        }

        try {
          // Get a checksum address and verify that the address is valid
          args.claimAddress = utils.getAddress(args.claimAddress);
        } catch (error) {
          throw Errors.INVALID_ETHEREUM_ADDRESS();
        }

        break;

      case CurrencyType.Sip10:
        this.logger.verbose('Sip10 swap args ' +  JSON.stringify(args));
        break;

    }

    const onchainTimeoutBlockDelta = this.timeoutDeltaProvider.getTimeout(args.pairId, side, true);

    let lightningTimeoutBlockDelta = TimeoutDeltaProvider.convertBlocks(
      sending,
      receiving,
      onchainTimeoutBlockDelta,
    );

    // Add 3 blocks to the delta for same currency swaps and 10% for cross chain ones as buffer
    lightningTimeoutBlockDelta += sending === receiving ? 3 : Math.ceil(lightningTimeoutBlockDelta * 0.4);
    this.logger.verbose('lightningTimeoutBlockDelta vs added: ' + lightningTimeoutBlockDelta + ', ' + Math.ceil(lightningTimeoutBlockDelta * 0.4));

    const rate = getRate(pairRate, side, true);
    const feePercent = this.rateProvider.feeProvider.getPercentageFee(args.pairId)!;
    const baseFee = this.rateProvider.feeProvider.getBaseFee(sendingCurrency.symbol, BaseFeeType.ReverseLockup);

    let onchainAmount: number;
    let holdInvoiceAmount: number;

    let percentageFee: number;

    // True when the invoice amount was set in the request, false when the onchain amount was set
    let invoiceAmountDefined: boolean;

    if (args.invoiceAmount !== undefined && args.onchainAmount !== undefined) {
      throw Errors.INVOICE_AND_ONCHAIN_AMOUNT_SPECIFIED();
    } else if (args.invoiceAmount !== undefined) {
      invoiceAmountDefined = true;

      this.checkWholeNumber(args.invoiceAmount);
      holdInvoiceAmount = args.invoiceAmount;

      onchainAmount = args.invoiceAmount * rate;

      percentageFee = Math.ceil(feePercent * onchainAmount);

      onchainAmount -= percentageFee + baseFee;
      onchainAmount = Math.floor(onchainAmount);
    } else if (args.onchainAmount !== undefined) {
      invoiceAmountDefined = false;

      this.checkWholeNumber(args.onchainAmount);
      onchainAmount = args.onchainAmount;

      holdInvoiceAmount = (args.onchainAmount + baseFee) / rate;
      holdInvoiceAmount = holdInvoiceAmount / (1 - feePercent);
      holdInvoiceAmount = Math.ceil(holdInvoiceAmount);

      percentageFee = Math.ceil(holdInvoiceAmount * rate * feePercent);
    } else {
      throw Errors.NO_AMOUNT_SPECIFIED();
    }

    this.verifyAmount(args.pairId, rate, holdInvoiceAmount, side, true);

    let prepayMinerFeeInvoiceAmount: number | undefined = undefined;
    let prepayMinerFeeOnchainAmount: number | undefined = undefined;

    const swapIsPrepayMinerFee = this.prepayMinerFee || args.prepayMinerFee === true;

    if (swapIsPrepayMinerFee) {
      if (sendingCurrency.type === CurrencyType.BitcoinLike) {
        prepayMinerFeeInvoiceAmount = Math.ceil(baseFee / rate);
        holdInvoiceAmount = Math.floor(holdInvoiceAmount - prepayMinerFeeInvoiceAmount);
      } else {
        const gasPrice = await getGasPrice(sendingCurrency.provider!);
        prepayMinerFeeOnchainAmount = ethereumPrepayMinerFeeGasLimit.mul(gasPrice).div(etherDecimals).toNumber();

        const sendingAmountRate = sending === 'ETH' ? 1 : this.rateProvider.rateCalculator.calculateRate('ETH', sending);

        const receivingAmountRate = receiving === 'ETH' ? 1 : this.rateProvider.rateCalculator.calculateRate('ETH', receiving);
        prepayMinerFeeInvoiceAmount = Math.ceil(prepayMinerFeeOnchainAmount * receivingAmountRate);

        // If the invoice amount was specified, the onchain and hold invoice amounts need to be adjusted
        if (invoiceAmountDefined) {
          onchainAmount -= Math.ceil(prepayMinerFeeOnchainAmount * sendingAmountRate);
          holdInvoiceAmount = Math.floor(holdInvoiceAmount - prepayMinerFeeInvoiceAmount);
        }
      }
    }

    if (onchainAmount < 1) {
      throw Errors.ONCHAIN_AMOUNT_TOO_LOW();
    }

    const {
      id,
      invoice,
      redeemScript,
      refundAddress,
      lockupAddress,
      minerFeeInvoice,
      timeoutBlockHeight,
    } = await this.swapManager.createReverseSwap({
      onchainAmount,
      percentageFee,
      holdInvoiceAmount,
      onchainTimeoutBlockDelta,
      lightningTimeoutBlockDelta,
      prepayMinerFeeInvoiceAmount,
      prepayMinerFeeOnchainAmount,

      orderSide: side,
      baseCurrency: base,
      quoteCurrency: quote,
      routingNode: args.routingNode,
      claimAddress: args.claimAddress,
      preimageHash: args.preimageHash,
      claimPublicKey: args.claimPublicKey,
    });

    this.eventHandler.emitSwapCreation(id);

    const response: any = {
      id,
      invoice,
      redeemScript,
      refundAddress,
      lockupAddress,
      timeoutBlockHeight,
    };

    if (swapIsPrepayMinerFee) {
      response.minerFeeInvoice = minerFeeInvoice;
      response.prepayMinerFeeAmount = prepayMinerFeeOnchainAmount;
    }

    if (invoiceAmountDefined) {
      response.onchainAmount = onchainAmount;
    }

    return response;
  }

  /**
   * Pays a lightning invoice
   */
  public payInvoice = async (symbol: string, invoice: string): Promise<Payment.AsObject> => {
    const { lndClient } = this.getCurrency(symbol);

    if (!lndClient) {
      throw Errors.NO_LND_CLIENT(symbol);
    }

    return lndClient.sendPayment(invoice);
  }

  /**
   * Sends coins to a specified address
   */
  public sendCoins = async (args: {
    symbol: string,
    address: string,
    amount: number,
    sendAll?: boolean,
    fee?: number,
  }): Promise<{
    vout: number,
    transactionId: string,
  }> => {
    const {
      fee,
      amount,
      symbol,
      sendAll,
      address,
     } = args;

    const wallet = this.walletManager.wallets.get(symbol);

    if (wallet !== undefined) {
      const { transactionId, vout } = sendAll ?
        await wallet.sweepWallet(address, fee) :
        await wallet.sendToAddress(address, amount, fee);

      return {
        transactionId,
        vout: vout!,
      };
    }
    console.log('service.ts line 1096');
    throw Errors.CURRENCY_NOT_FOUND(symbol);
  }

  public mintNFT = async (nftAddress: string, userAddress: string, stxAmount: number, contractSignature?: string): Promise<{
    id: string,
    invoice: string,
  }> => {
    this.logger.verbose(`s.1481 mintNFT with ${nftAddress}, ${userAddress}, ${stxAmount} and ${contractSignature}`);

    if(stxAmount < 0) {
      throw Errors.MINT_COST_MISMATCH();
    } 

    // check contract signature to see how much it would cost to mint
    // find a previous call of the same function and add up stx transfers of that call
    const mintCostStx = stxAmount * 10**6; // 10000000;
    const calcMintCostStx = await calculateStxOutTx(nftAddress, contractSignature!);
    if(calcMintCostStx && calcMintCostStx > mintCostStx) {
      this.logger.error(`s.1492 calcMintCostStx issue ${calcMintCostStx} > ${mintCostStx}`);  
      throw Errors.MINT_COST_MISMATCH();
    } 
    // this.logger.verbose(`s.1484 mintCostStx ${mintCostStx}`);

    // TODO: maybe add whitelisted NFT contracts to avoid issues?

    // add a check to make sure lnswap signer has enough funds before creating swap
    const signerBalances = await getAddressAllBalances();
    console.log('s.1504 signerBalances ', signerBalances);
    if (mintCostStx > signerBalances['STX']) {
      throw Errors.EXCEEDS_SWAP_LIMIT();
    }

    // convert to BTC + fees + generate LN invoice
    const sendingAmountRate = this.rateProvider.rateCalculator.calculateRate('BTC', 'STX');
    this.logger.verbose(`s.1488 sendingAmountRate ${sendingAmountRate}`); //18878.610534264677

    const percentageFee = this.rateProvider.feeProvider.getPercentageFee('BTC/STX');
    const baseFee = this.rateProvider.feeProvider.getBaseFee('STX', BaseFeeType.NormalClaim);
    this.logger.verbose(`s.1492 percentageFee ${percentageFee} baseFee ${baseFee}`); // 0.05 baseFee 87025

    // add cost + fee, multiply by 100 (mstx -> satoshi), add percentage fee and convert to bitcoin
    const invoiceAmount = Math.ceil((mintCostStx + baseFee) * 100 * (1+percentageFee) / sendingAmountRate)
    // const invoiceAmount = this.calculateInvoiceAmount(0, sendingAmountRate, mintCostStx, baseFee, percentageFee);
    this.logger.verbose(`s.1495 invoiceAmount ${invoiceAmount}`);

    const currency = this.getCurrency('BTC');
    const invoice = await currency.lndClient?.addInvoice(invoiceAmount, undefined, `Mint NFT for ${nftAddress}`);
    this.logger.verbose(`s.1499 mintNFT invoice ${invoice?.paymentRequest}`);

    // create swap + enter info in db in a new table
    const id = generateId();
    this.directSwapRepository.addDirectSwap({
      id, nftAddress, userAddress, contractSignature, invoice: invoice!.paymentRequest, mintCostStx, status: 'swap.created'
    })
    this.eventHandler.emitSwapCreation(id);

    // listen to invoice payment
    this.logger.verbose(`s.1517 paymentHash ${decodeInvoice(invoice!.paymentRequest).paymentHash!}`);
    // dont subscribe to each invoice separately - subscribing to all in lndclient
    // currency.lndClient!.subscribeSingleInvoice(getHexBuffer(decodeInvoice(invoice!.paymentRequest).paymentHash!));

    // call contract so user gets NFT upon LN payment
    // listener is started at the beginning which will handle this.

    return {
      id,
      invoice: invoice!.paymentRequest
    }
  }


  /**
   * Verifies that the requested amount is neither above the maximal nor beneath the minimal
   */
  private verifyAmount = (pairId: string, rate: number, amount: number, orderSide: OrderSide, isReverse: boolean) => {
    if (
        (!isReverse && orderSide === OrderSide.BUY) ||
        (isReverse && orderSide === OrderSide.SELL)
      ) {
      // tslint:disable-next-line:no-parameter-reassignment
      amount = Math.floor(amount * rate);
      console.log('s.1320 amount ', amount);
    } else {
      // convert amount for atomic swaps
      amount = Math.floor(amount * 1/rate);
      console.log('s.1343 amount ', amount, rate);
    }

    const { limits } = this.getPair(pairId);
    console.log('s.1324 amount vs limits ', amount, limits);
    // check if amount is greater than what's available in account

    if (limits) {
      // modified minimum limit to 1/2 so we don't run into issues with test amounts
      if (Math.floor(amount) > limits.maximal) throw Errors.EXCEED_MAXIMAL_AMOUNT(amount, limits.maximal);
      if (Math.ceil(amount) < limits.minimal/2) throw Errors.BENEATH_MINIMAL_AMOUNT(amount, limits.minimal);
    } else {
      throw Errors.PAIR_NOT_FOUND(pairId);
    }
  }

  /**
   * Calculates the amount of an invoice for a Submarine Swap
   */
  private calculateInvoiceAmount = (orderSide: number, rate: number, onchainAmount: number, baseFee: number, percentageFee: number) => {
    if (orderSide === OrderSide.BUY) {
      rate = 1 / rate;
    }
    console.log('s.1425 calculateInvoiceAmount: ', onchainAmount, baseFee, rate, percentageFee);
    return Math.floor(
      ((onchainAmount - baseFee) * rate) / (1 + percentageFee),
    );
  }

  private calculateInvoiceAmountAS = (orderSide: number, rate: number, onchainAmount: number, baseFee: number, percentageFee: number) => {
    if (orderSide === OrderSide.BUY) {
      rate = 1 / rate;
    }
    console.log('s.1435 calculateInvoiceAmountAS: ', onchainAmount, baseFee, rate, percentageFee);
    return Math.floor(
      ((onchainAmount - baseFee) * rate) * (1 + percentageFee),
    );
  }

  private calculateOnchainAmount = (orderSide: number, rate: number, onchainAmount: number, baseFee: number, percentageFee: number) => {
    if (orderSide === OrderSide.BUY) {
      rate = 1 / rate;
    }

    // stx -> btcln calculateOnchainAmount:  0.4007220000000001 87025 21710.811984368214 0.05
    console.log('s.1437 calculateOnchainAmount, baseFee, rate, percentageFee: ', onchainAmount, baseFee, rate, percentageFee);
    return Math.floor(
      (onchainAmount - baseFee) / (1 + percentageFee),
    );
  }

  private getPair = (pairId: string) => {
    const { base, quote } = splitPairId(pairId);

    const pair = this.rateProvider.pairs.get(pairId);

    if (!pair) {
      throw Errors.PAIR_NOT_FOUND(pairId);
    }

    return {
      base,
      quote,
      ...pair,
    };
  }

  private getCurrency = (symbol: string) => {
    const currency = this.currencies.get(symbol);

    if (!currency) {
      console.log('service.ts line 1155');
      throw Errors.CURRENCY_NOT_FOUND(symbol);
    }

    return currency;
  }

  private getOrderSide = (side: string) => {
    switch (side.toLowerCase()) {
      case 'buy': return OrderSide.BUY;
      case 'sell': return OrderSide.SELL;

      default: throw Errors.ORDER_SIDE_NOT_FOUND(side);
    }
  }

  private calculateTimeoutDate = (chain: string, blocksMissing: number) => {
    return getUnixTime() + (blocksMissing * TimeoutDeltaProvider.blockTimes.get(chain)! * 60);
  }

  private validatePairHash = (pairId: string, pairHash: string) => {
     if (pairHash !== this.rateProvider.pairs.get(pairId)!.hash) {
       throw Errors.INVALID_PAIR_HASH();
     }
  }

  private checkWholeNumber = (input: number) => {
    if (input % 1 !== 0) {
      throw Errors.NOT_WHOLE_NUMBER(input);
    }
  }

  private startNFTListener = () => {
    if(!this.serviceInvoiceListener) {
      this.logger.verbose(`s.1675 startNFTListener starting serviceInvoiceListener`);

      const currency = this.getCurrency('BTC');
      this.serviceInvoiceListener = currency.lndClient!.on('invoice.settled', async (settledInvoice: string) => {
        this.logger.verbose(`s.1522 got invoice.settled from lndclient for invoice ${settledInvoice}`);

        const directSwap = await this.directSwapRepository.getSwap({
          invoice: {
            [Op.eq]: settledInvoice,
          },
          status: {
            [Op.eq]: SwapUpdateEvent.SwapCreated,
          },
        });

        if(directSwap) {
          console.log('s.1555 found directSwap id ', directSwap.id);
          const txId = await mintNFTforUser(directSwap.nftAddress, directSwap.contractSignature!, directSwap.userAddress, directSwap.mintCostStx!);
          if (!txId.includes('error')) {
            await this.directSwapRepository.setSwapStatus(directSwap, 'nft.minted', undefined, txId);
            this.logger.verbose(`s.1533 directSwap ${directSwap.id} updated with txId ${txId}`);
            this.eventHandler.emitSwapNftMinted(directSwap.id, txId);
          } 
          if (txId.includes('error')) {
            this.logger.error(`s.1561 directSwap ${directSwap.id} failed with error ${txId}`);
            await this.directSwapRepository.setSwapStatus(directSwap, 'transaction.failed', txId, txId);
            this.eventHandler.emitSwapNftMintFailed(directSwap.id, txId);
          }

        }
        //  else {
        //   console.log(`s.1557 no directSwap found for ${settledInvoice}`);
        // }

        // old method
        // if (settledInvoice === invoice!.paymentRequest) {
        //   const txId = await mintNFTforUser(nftAddress, contractSignature!, userAddress, mintCostStx)
        //   if(txId == 'error') {
        //     this.logger.error(`s.1546 mintNFTforUser errored and stopped`);
        //     // return;
        //   }
        //   const directSwap = await this.directSwapRepository.getSwap({
        //     id: {
        //       [Op.eq]: id,
        //     }
        //   });

        //   if (directSwap && !txId.includes('error')) {
        //     await this.directSwapRepository.setSwapStatus(directSwap, 'nft.minted', undefined, txId);
        //     this.logger.verbose(`s.1533 directSwap ${id} updated with txId ${txId}`);
        //     this.eventHandler.emitSwapNftMinted(id, txId);
        //   } 
        //   if (directSwap && txId.includes('error')) {
        //     this.logger.error(`s.1561 directSwap ${id} failed with error ${txId}`);
        //     await this.directSwapRepository.setSwapStatus(directSwap, 'transaction.failed', txId, txId);
        //     this.eventHandler.emitSwapNftMintFailed(id, txId);
        //   }
        // }
      });
    }
  }


}

export default Service;
