import { Op } from 'sequelize';
import AsyncLock from 'async-lock';
import { EventEmitter } from 'events';
import { crypto, Transaction } from 'bitcoinjs-lib';
import { BigNumber, ContractTransaction } from 'ethers';
import { constructClaimTransaction, constructRefundTransaction, detectSwap, OutputType } from 'boltz-core';
import Errors from './Errors';
import Logger from '../Logger';
import Swap from '../db/models/Swap';
import Wallet from '../wallet/Wallet';
import UtxoNursery from './UtxoNursery';
import ChannelNursery from './ChannelNursery';
import InvoiceNursery from './InvoiceNursery';
import FeeProvider from '../rates/FeeProvider';
import LndClient from '../lightning/LndClient';
import ChainClient from '../chain/ChainClient';
import EthereumNursery from './EthereumNursery';
import RskNursery from './RskNursery';
import StacksNursery from './StacksNursery';
import RateProvider from '../rates/RateProvider';
import SwapRepository from '../db/SwapRepository';
import LightningNursery from './LightningNursery';
import ReverseSwap from '../db/models/ReverseSwap';
import { Invoice, PaymentFailureReason } from '../proto/lnd/rpc_pb';
import ChannelCreation from '../db/models/ChannelCreation';
import ReverseSwapRepository from '../db/ReverseSwapRepository';
import ContractHandler from '../wallet/ethereum/ContractHandler';
import RskContractHandler from '../wallet/rsk/ContractHandler';
import StacksContractHandler from '../wallet/stacks/ContractHandler';
import WalletManager, { Currency } from '../wallet/WalletManager';
import { ERC20SwapValues, EtherSwapValues } from '../consts/Types';
import ChannelCreationRepository from '../db/ChannelCreationRepository';
import { etherDecimals, ReverseSwapOutputType } from '../consts/Consts';
import ERC20WalletProvider from '../wallet/providers/ERC20WalletProvider';
import { ChannelCreationStatus, CurrencyType, SwapUpdateEvent } from '../consts/Enums';
import { queryERC20SwapValuesFromLock, queryEtherSwapValuesFromLock } from '../wallet/ethereum/ContractUtils';
import {
  calculateEthereumTransactionFee,
  calculateRskTransactionFee,
  calculateUtxoTransactionFee,
  decodeInvoice,
  formatError,
  getChainCurrency,
  getHexBuffer,
  getHexString,
  getLightningCurrency,
  getRate,
  splitPairId,
  getScriptHashFunction,
  // stringify,
} from '../Utils';
import InvoiceState = Invoice.InvoiceState;
import { TxBroadcastResult } from '@stacks/transactions';
import { getInfo, incrementNonce, querySip10SwapValuesFromTx, querySwapValuesFromTx } from '../wallet/stacks/StacksUtils';
import SIP10WalletProvider from '../wallet/providers/SIP10WalletProvider';

import mempoolJS from "@mempool/mempool.js";
const { bitcoin: { transactions } } = mempoolJS({
  hostname: 'mempool.space'
});

interface SwapNursery {
  // UTXO based chains emit the "Transaction" object and Ethereum based ones just the transaction hash
  on(event: 'transaction', listener: (swap: Swap | ReverseSwap, transaction: Transaction | string, confirmed: boolean, isReverse: boolean) => void): this;
  emit(event: 'transaction', swap: Swap | ReverseSwap, transaction: Transaction | string, confirmed: boolean, isReverse: boolean): boolean;

  on(event: 'expiration', listener: (swap: Swap | ReverseSwap, isReverse: boolean) => void): this;
  emit(event: 'expiration', swap: Swap | ReverseSwap, isReverse: boolean): boolean;

  // Swap related events
  on(event: 'lockup.failed', listener: (swap: Swap) => void): this;
  emit(event: 'lockup.failed', swap: Swap): boolean;

  on(event: 'zeroconf.rejected', listener: (swap: Swap) => void): this;
  emit(event: 'zeroconf.rejected', swap: Swap): boolean;

  on(event: 'invoice.pending', listener: (swap: Swap) => void): this;
  emit(even: 'invoice.pending', swap: Swap): boolean;

  on(event: 'invoice.failedToPay', listener: (swap: Swap) => void): this;
  emit(event: 'invoice.failedToPay', swap: Swap): boolean;

  on(event: 'invoice.paid', listener: (swap: Swap) => void): this;
  emit(event: 'invoice.paid', swap: Swap): boolean;

  on(event: 'claim', listener: (swap: Swap, channelCreation?: ChannelCreation) => void): this;
  emit(event: 'claim', swap: Swap, channelCreation?: ChannelCreation): boolean;

  // Reverse swap related events
  on(event: 'minerfee.paid', listener: (reverseSwap: ReverseSwap) => void): this;
  emit(event: 'minerfee.paid', reverseSwap: ReverseSwap): boolean;

  on(event: 'invoice.expired', listener: (reverseSwap: ReverseSwap) => void): this;
  emit(event: 'invoice.expired', reverseSwap: ReverseSwap): boolean;

  // UTXO based chains emit the "Transaction" object and Ethereum based ones just the transaction hash
  on(event: 'coins.sent', listener: (reverseSwap: ReverseSwap, transaction: Transaction | string) => void): this;
  emit(event: 'coins.sent', reverseSwap: ReverseSwap, transaction: Transaction | string): boolean;

  on(event: 'coins.sent', listener: (swap: Swap, transaction: Transaction | string) => void): this;
  emit(event: 'coins.sent', swap: Swap, transaction: Transaction | string): boolean;

  on(event: 'coins.failedToSend', listener: (reverseSwap: ReverseSwap) => void): this;
  emit(event: 'coins.failedToSend', reverseSwap: ReverseSwap): boolean;

  on(event: 'coins.failedToSend', listener: (swap: Swap) => void): this;
  emit(event: 'coins.failedToSend', swap: Swap): boolean;

  on(event: 'refund', listener: (reverseSwap: ReverseSwap, refundTransaction: string) => void): this;
  emit(event: 'refund', reverseSwap: ReverseSwap, refundTransaction: string): boolean;

  on(event: 'refund', listener: (reverseSwap: Swap, refundTransaction: string) => void): this;
  emit(event: 'refund', reverseSwap: Swap, refundTransaction: string): boolean;

  on(event: 'invoice.settled', listener: (reverseSwap: ReverseSwap) => void): this;
  emit(event: 'invoice.settled', reverseSwap: ReverseSwap): boolean;

  //  added to cover stacks tx mempool -> confirmed
  on(event: 'tx.sent', listener: (reverseSwap: ReverseSwap, transactionHash: string) => void): this;
  emit(event: 'tx.sent', reverseSwap: ReverseSwap): boolean;

  on(event: 'astransaction.confirmed', listener: (swap: Swap, transaction: Transaction | string, preimage?: string) => void): this;
  emit(event: 'astransaction.confirmed', swap: Swap, transaction: Transaction | string, preimage?: string): boolean;

  on(event: 'as.claimed', listener: (swap: Swap, transaction: Transaction | string, preimage: Buffer) => void): this;
  emit(event: 'as.claimed', swap: Swap, transaction: Transaction | string, preimage: Buffer): boolean;

  on(event: 'transaction.claimed', listener: (swap: Swap, transaction: Transaction | string, preimage?: string) => void): this;
  emit(event: 'transaction.claimed', swap: Swap, transaction: Transaction | string, preimage?: string): boolean;
}

class SwapNursery extends EventEmitter {
  // Constants
  public static reverseSwapMempoolEta = 2;

  // Nurseries
  private readonly utxoNursery: UtxoNursery;
  public readonly channelNursery: ChannelNursery;
  private readonly invoiceNursery: InvoiceNursery;
  private readonly lightningNursery: LightningNursery;

  private readonly ethereumNursery?: EthereumNursery;
  private readonly rskNursery?: RskNursery;
  private readonly stacksNursery?: StacksNursery;

  // Maps
  private currencies = new Map<string, Currency>();

  // Locks
  private lock = new AsyncLock();

  private static retryLock = 'retry';

  private static swapLock = 'swap';
  private static reverseSwapLock = 'reverseSwap';

  constructor(
    private logger: Logger,
    private rateProvider: RateProvider,
    private walletManager: WalletManager,
    private swapRepository: SwapRepository,
    private reverseSwapRepository: ReverseSwapRepository,
    private channelCreationRepository: ChannelCreationRepository,
    private swapOutputType: OutputType,
    private retryInterval: number,
  ) {
    super();

    this.logger.info(`Setting Swap retry interval to ${retryInterval} seconds`);

    this.utxoNursery = new UtxoNursery(
      this.logger,
      this.walletManager,
      this.swapRepository,
      this.reverseSwapRepository,
    );

    this.lightningNursery = new LightningNursery(
      this.logger,
      this.reverseSwapRepository,
    );

    this.invoiceNursery = new InvoiceNursery(
      this.logger,
      this.reverseSwapRepository,
    );

    if (this.walletManager.ethereumManager) {
      this.ethereumNursery = new EthereumNursery(
        this.logger,
        this.walletManager,
        this.swapRepository,
        this.reverseSwapRepository,
      );
    }

    if (this.walletManager.rskManager) {
      this.rskNursery = new RskNursery(
        this.logger,
        this.walletManager,
        this.swapRepository,
        this.reverseSwapRepository,
      );
    }

    if (this.walletManager.stacksManager) {
      this.stacksNursery = new StacksNursery(
        this.logger,
        this.walletManager,
        this.swapRepository,
        this.reverseSwapRepository,
      );
    }

    this.channelNursery = new ChannelNursery(
      this.logger,
      this.swapRepository,
      this.channelCreationRepository,
      this.attemptSettleSwap,
    );
  }

  public init = async (currencies: Currency[]): Promise<void> => {
    currencies.forEach((currency) => {
      this.currencies.set(currency.symbol, currency);
    });

    if (this.ethereumNursery) {
      // this.logger.error("swapnursery this.ethereumNursery");
      await this.listenEthereumNursery(this.ethereumNursery);
    }

    if (this.rskNursery) {
      // this.logger.error("swapnursery this.listenRskNursery");
      await this.listenRskNursery(this.rskNursery!);
    }

    if (this.stacksNursery) {
      // this.logger.error("swapnursery this.listenstacksNursery");
      await this.listenStacksNursery(this.stacksNursery!);
    }

    // Swap events
    this.utxoNursery.on('swap.expired', async (swap) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.expireSwap(swap);
      });
    });

    this.utxoNursery.on('swap.lockup.failed', async (swap, reason) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.lockupFailed(swap, reason);
      });
    });

      this.utxoNursery.on('swap.lockup.zeroconf.rejected', async (swap, transaction, reason) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.logger.warn(`Rejected 0-conf lockup transaction (${transaction.getId()}) of ${swap.id}: ${reason}`);

        if (!swap.invoice) {
          await this.setSwapRate(swap);
        }

        this.emit('zeroconf.rejected', await this.swapRepository.setSwapStatus(swap, SwapUpdateEvent.TransactionZeroConfRejected));
      });
    });

    this.utxoNursery.on('swap.lockup', async (swap, transaction, confirmed) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transaction, confirmed, false);

        console.log('swapnursery.249 swap.lockup ', swap.id);
        if (swap.invoice) {
          const { base, quote } = splitPairId(swap.pair);
          const chainSymbol = getChainCurrency(base, quote, swap.orderSide, false);

          const { chainClient } = this.currencies.get(chainSymbol)!;
          const wallet = this.walletManager.wallets.get(chainSymbol)!;

          await this.claimUtxo(chainClient!, wallet, swap, transaction);
        } else if (swap && swap.redeemScript) {
          // onchain swap coins locked & confirmed - no triggers in mempool as well!
          // TODO:::: why mempool
          console.log('swapnursery.260 onchain swap confirmed ', swap.id);

          const { base, quote } = splitPairId(swap.pair);
          const chainSymbol = getChainCurrency(base, quote, swap.orderSide, false);
          const otherChainSymbol = getChainCurrency(quote, base, swap.orderSide, false);
          console.log('swapnursery.281 ', otherChainSymbol);
          // const { chainClient } = this.currencies.get(chainSymbol)!;
          let walletToSend = this.walletManager.wallets.get(chainSymbol)!;
          let wallet = this.walletManager.wallets.get(chainSymbol)!.walletProvider as SIP10WalletProvider;
          if(!wallet.getTokenContractAddress) {
            wallet = this.walletManager.wallets.get(otherChainSymbol)!.walletProvider as SIP10WalletProvider;
            walletToSend = this.walletManager.wallets.get(otherChainSymbol)!;
          }
          // we lock to the other chain!
          // const walletToSend = this.walletManager.wallets.get(chainSymbol)!;
          const otherlock = await this.lockupStxSwap(walletToSend, swap, undefined);
          console.log('swapnursery.269 end of utxo swap.lockup ', otherlock);
        } else {
          console.log('swapnursery.259 swap.lockup no invoice ', swap.id);
          await this.setSwapRate(swap);
        }
      });
    });

    // Reverse Swap events
    this.utxoNursery.on('reverseSwap.expired', async (reverseSwap) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.expireReverseSwap(reverseSwap);
      });
    });

    this.utxoNursery.on('reverseSwap.lockup.confirmed', async (reverseSwap, transaction) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.emit('transaction', reverseSwap, transaction, true, true);
      });
    });

    // atomic swap events
    this.utxoNursery.on('astransaction.confirmed', async (swap, transactionHash, preimage) => {
      // this.logger.error('swapnursery.304 astransaction.confirmed: ' + transactionHash);
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        if(preimage) {
          // trigger claimstx so we get the stx user locked into the contract
          if(swap.tokenAddress) {
            console.log('swapn.313 triggering claimSip10 after finding preimage in utxonursery tx');
            await this.claimSip10(
              this.walletManager.stacksManager!.contractHandler,
              swap,
              // await queryEtherSwapValuesFromLock(this.walletManager.rskManager!.etherSwap, swap.lockupTransactionId!),
              // await querySwapValuesFromTx(swap.lockupTransactionId!),
              undefined,
              undefined,
              preimage
              // outgoingChannelId,
            );
          } else {
            console.log('swapn.325 triggering claimstx after finding preimage in utxonursery tx');
            await this.claimStx(
              this.walletManager.stacksManager!.contractHandler,
              swap,
              // await queryEtherSwapValuesFromLock(this.walletManager.rskManager!.etherSwap, swap.lockupTransactionId!),
              // await querySwapValuesFromTx(swap.lockupTransactionId!),
              undefined,
              undefined,
              preimage
              // outgoingChannelId,
            );
          }
          this.emit('transaction.claimed', swap, transactionHash);
        } else {
          // from before
          // , true, true
          this.emit('astransaction.confirmed', swap, transactionHash);
        }
      });
    });

    this.lightningNursery.on('minerfee.invoice.paid', async (reverseSwap) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.emit('minerfee.paid', reverseSwap);
      });
    });

    this.lightningNursery.on('invoice.paid', async (reverseSwap) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        const { base, quote } = splitPairId(reverseSwap.pair);
        const chainSymbol = getChainCurrency(base, quote, reverseSwap.orderSide, true);
        const lightningSymbol = getLightningCurrency(base, quote, reverseSwap.orderSide, true);

        const chainCurrency = this.currencies.get(chainSymbol)!;
        const { lndClient } = this.currencies.get(lightningSymbol)!;

        const wallet = this.walletManager.wallets.get(chainSymbol)!;
        this.logger.verbose('swapnursery.291 invoice.paid wallet ');
        // + JSON.stringify(wallet)

          switch (chainCurrency.type) {
          case CurrencyType.BitcoinLike:
            await this.lockupUtxo(
              chainCurrency.chainClient!,
              this.walletManager.wallets.get(chainSymbol)!,
              lndClient!,
              reverseSwap
            );
            break;

          case CurrencyType.Ether:
            await this.lockupEther(
              wallet,
              lndClient!,
              reverseSwap,
            );
            break;

          case CurrencyType.ERC20:
            this.logger.error('swapnursery reverseswap invoice.paid lockupERC20 for' + quote);
            if(quote == 'SOV') {
              await this.rlockupERC20(
                wallet,
                lndClient!,
                reverseSwap,
              );
            } else {
              await this.lockupERC20(
                wallet,
                lndClient!,
                reverseSwap,
              );
            }

            break;

          case CurrencyType.Stx:
            this.logger.debug('swapnursery reverseswap invoice.paid lockupStx for ' + quote);
            await this.lockupStx(
              wallet,
              lndClient!,
              reverseSwap,
            );

            // if(quote == "SOV") {
            //   await this.rlockupERC20(
            //     wallet,
            //     lndClient!,
            //     reverseSwap,
            //   );
            // } else {
            //   await this.lockupERC20(
            //     wallet,
            //     lndClient!,
            //     reverseSwap,
            //   );
            // }

            break;

            case CurrencyType.Sip10:
              this.logger.debug('swapnursery reverseswap invoice.paid lockupToken for ' + quote);
              await this.lockupToken(
                wallet,
                lndClient!,
                reverseSwap,
              );

        }
      });
    });

    this.utxoNursery.on('reverseSwap.claimed', async (reverseSwap: ReverseSwap, preimage: Buffer) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.settleReverseSwapInvoice(reverseSwap, preimage);
      });
    });

    this.invoiceNursery.on('invoice.expired', async (reverseSwap: ReverseSwap) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        const { base, quote } = splitPairId(reverseSwap.pair);
        const receiveCurrency = getLightningCurrency(base, quote, reverseSwap.orderSide, true);
        const lndClient = this.currencies.get(receiveCurrency)!.lndClient!;

        const plural = reverseSwap.minerFeeInvoicePreimage === null ? '' : 's';

        try {
          // Check if the hold invoice has pending HTLCs before actually cancelling
          const { htlcsList, state } = await lndClient.lookupInvoice(getHexBuffer(reverseSwap.preimageHash));

          if (state === InvoiceState.CANCELED) {
            this.logger.debug(`Invoice${plural} of Reverse Swap ${reverseSwap.id} already cancelled`);
          } else {
            if (htlcsList.length !== 0) {
              this.logger.info(`Not cancelling expired hold invoice${plural} of Reverse Swap ${reverseSwap.id} because it has pending HTLCs`);
              return;
            }

            this.logger.debug(`Cancelling expired hold invoice${plural} of Reverse Swap ${reverseSwap.id}`);

            await lndClient.cancelInvoice(getHexBuffer(reverseSwap.preimageHash));

            if (reverseSwap.minerFeeInvoicePreimage) {
              await lndClient.cancelInvoice(crypto.sha256(getHexBuffer(reverseSwap.minerFeeInvoicePreimage)));
            }
          }
        } catch (error) {
          // In case the LND client could not find the invoice(s) of the Reverse Swap, we just ignore the error and mark them as cancelled regardless
          // This happens quite a lot on regtest environments where the LND client is reset without the database being deleted
          if (typeof error !== 'object' || (error.details !== 'unable to locate invoice' && error.details !== 'there are no existing invoices')) {
            this.logger.error(`Could not cancel invoice${plural} of Reverse Swap ${reverseSwap.id}: ${formatError(error)}`);
            return;
          } else {
            this.logger.silly(`Cancelling invoice${plural} of Reverse Swap ${reverseSwap.id} failed although the LND client could find them: ${formatError(error)}`);
          }
        }

        this.emit('invoice.expired', await this.reverseSwapRepository.setReverseSwapStatus(reverseSwap, SwapUpdateEvent.InvoiceExpired));
      });
    });

    this.utxoNursery.bindCurrency(currencies);
    this.lightningNursery.bindCurrencies(currencies);

    await this.invoiceNursery.init();
    await this.channelNursery.init(currencies);

    if (this.retryInterval !== 0) {
      setInterval(async () => {
        // Skip this iteration if the last one is still running
        if (this.lock.isBusy(SwapNursery.retryLock)) {
          return;
        }

        this.logger.silly('Retrying settling Swaps with pending invoices');

        await this.lock.acquire(SwapNursery.retryLock, async () => {
          await this.lock.acquire(SwapNursery.swapLock, async () => {
            const pendingInvoiceSwaps = await this.swapRepository.getSwaps({
              status: {
                [Op.eq]: SwapUpdateEvent.InvoicePending,
              },
            });

            for (const pendingInvoiceSwap of pendingInvoiceSwaps) {
              const { base, quote } = splitPairId(pendingInvoiceSwap.pair);
              const chainCurrency = this.currencies.get(getChainCurrency(base, quote, pendingInvoiceSwap.orderSide, false))!;

              await this.attemptSettleSwap(chainCurrency, pendingInvoiceSwap);
            }
          });
        });
      }, this.retryInterval * 1000);
    }
  }

  public attemptSettleSwap = async (currency: Currency, swap: Swap, outgoingChannelId?: string): Promise<void> => {
    switch (currency.type) {
      case CurrencyType.BitcoinLike: {
        this.logger.info('swapnursery.538 attemptSettleSwap getRawTransaction');
        // const lockupTransactionHex = await currency.chainClient!.getRawTransaction(swap.lockupTransactionId!);
        let lockupTransactionHex;
        // need blockhash because we're running a pruned node with no -txindex
        if((await getInfo()).network_id === 1) {
          const mempoolTx = await transactions.getTx({ txid: swap.lockupTransactionId! });
          lockupTransactionHex = await currency.chainClient!.getRawTransactionBlockHash(swap.lockupTransactionId!, mempoolTx.status.block_hash);
        } else {
          // regtest
          lockupTransactionHex = await currency.chainClient!.getRawTransaction(swap.lockupTransactionId!);
        }

        await this.claimUtxo(
          currency.chainClient!,
          this.walletManager.wallets.get(currency.symbol)!,
          swap,
          Transaction.fromHex(lockupTransactionHex),
          outgoingChannelId,
        );
        break;
      }

      case CurrencyType.Ether:
        await this.claimEther(
          this.walletManager.ethereumManager!.contractHandler,
          swap,
          await queryEtherSwapValuesFromLock(this.walletManager.ethereumManager!.etherSwap, swap.lockupTransactionId!),
          outgoingChannelId,
        );
        break;

      case CurrencyType.ERC20:
        this.logger.error('attemptSettleSwap ERC20 ' + currency.symbol);
        await this.claimERC20(
          this.walletManager.ethereumManager!.contractHandler,
          swap,
          await queryERC20SwapValuesFromLock(this.walletManager.ethereumManager!.erc20Swap, swap.lockupTransactionId!),
          outgoingChannelId,
        );
        break;

      case CurrencyType.Rbtc:
        await this.claimRbtc(
          this.walletManager.rskManager!.contractHandler,
          swap,
          await queryEtherSwapValuesFromLock(this.walletManager.rskManager!.etherSwap, swap.lockupTransactionId!),
          outgoingChannelId,
        );
        break;

      case CurrencyType.Stx:
        // TODO: this happens when invoice can not be paid / no route
        // + stringify(this.walletManager.stacksManager!)
        this.logger.error('swapnursery.476 attemptSettleSwap, ' + swap.lockupTransactionId!);
        // this.logger.verbose("???480 swap: " + stringify(swap));
        // error: Unhandled rejection: Cannot read property 'etherSwap' of undefined
        // transactionhash = 0xb7c491801d4aee63263c69734fb66cd5e64b0b9 is shorter compared to stacks chain
        // 0xb7c491801d4aee63263c69734fb66cd5e64b0b9d47f943216bef31feaec2959c
        await this.claimStx(
          this.walletManager.stacksManager!.contractHandler,
          swap,
          // await queryEtherSwapValuesFromLock(this.walletManager.rskManager!.etherSwap, swap.lockupTransactionId!),
          await querySwapValuesFromTx(swap.lockupTransactionId!),
          outgoingChannelId,
        );
        break;

    }
  }

  private listenEthereumNursery = async (ethereumNursery: EthereumNursery) => {
    const contractHandler = this.walletManager.ethereumManager!.contractHandler;

    // Swap events
    ethereumNursery.on('swap.expired', async (swap) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.expireSwap(swap);
      });
    });

    ethereumNursery.on('lockup.failed', async (swap, reason) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.lockupFailed(swap, reason);
      });
    });

    ethereumNursery.on('eth.lockup', async (swap, transactionHash, etherSwapValues) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, false);

        if (swap.invoice) {
          await this.claimEther(contractHandler, swap, etherSwapValues);
        } else {
          await this.setSwapRate(swap);
        }
      });
    });

    ethereumNursery.on('erc20.lockup', async (swap, transactionHash, erc20SwapValues) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, false);

        if (swap.invoice) {
          await this.claimERC20(contractHandler, swap, erc20SwapValues);
        } else {
          await this.setSwapRate(swap);
        }
      });
    });

    // Reverse Swap events
    ethereumNursery.on('reverseSwap.expired', async (reverseSwap) => {
      this.logger.error('ethereumNursery reverseSwap.expired ');
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.expireReverseSwap(reverseSwap);
      });
    });

    ethereumNursery.on('lockup.failedToSend', async (reverseSwap: ReverseSwap, reason ) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        const { base, quote } = splitPairId(reverseSwap.pair);
        const chainSymbol = getChainCurrency(base, quote, reverseSwap.orderSide, true);
        const lightningSymbol = getLightningCurrency(base, quote, reverseSwap.orderSide, true);

        await this.handleReverseSwapSendFailed(
          reverseSwap,
          chainSymbol,
          this.currencies.get(lightningSymbol)!.lndClient!,
          reason);
      });
    });

    ethereumNursery.on('lockup.confirmed', async (reverseSwap, transactionHash) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.emit('transaction', reverseSwap, transactionHash, true, true);
      });
    });

    ethereumNursery.on('claim', async (reverseSwap, preimage) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.settleReverseSwapInvoice(reverseSwap, preimage);
      });
    });

    await ethereumNursery.init();
  }

  private listenRskNursery = async (rskNursery: RskNursery) => {
    const contractHandler = this.walletManager.rskManager!.contractHandler;

    // Swap events
    rskNursery.on('swap.expired', async (swap) => {
      this.logger.error('rskNursery swap.expired ');
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.expireSwap(swap);
      });
    });

    rskNursery.on('lockup.failed', async (swap, reason) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.lockupFailed(swap, reason);
      });
    });

    rskNursery.on('eth.lockup', async (swap, transactionHash, etherSwapValues) => {
      this.logger.error('listenRskNursery eth.lockup: ' + transactionHash);
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, false);

        if (swap.invoice) {
          await this.claimRbtc(contractHandler, swap, etherSwapValues);
        } else {
          await this.setSwapRate(swap);
        }
      });
    });

    rskNursery.on('erc20.lockup', async (swap, transactionHash, erc20SwapValues) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, false);

        if (swap.invoice) {
          await this.claimRskERC20(contractHandler, swap, erc20SwapValues);
        } else {
          await this.setSwapRate(swap);
        }
      });
    });

    // Reverse Swap events
    rskNursery.on('reverseSwap.expired', async (reverseSwap) => {
      this.logger.error('rskNursery reverseSwap.expired ');
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.expireReverseSwap(reverseSwap);
      });
    });

    rskNursery.on('lockup.failedToSend', async (reverseSwap: ReverseSwap, reason ) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        const { base, quote } = splitPairId(reverseSwap.pair);
        const chainSymbol = getChainCurrency(base, quote, reverseSwap.orderSide, true);
        const lightningSymbol = getLightningCurrency(base, quote, reverseSwap.orderSide, true);

        await this.handleReverseSwapSendFailed(
          reverseSwap,
          chainSymbol,
          this.currencies.get(lightningSymbol)!.lndClient!,
          reason);
      });
    });

    rskNursery.on('lockup.confirmed', async (reverseSwap, transactionHash) => {
      this.logger.error('listenRskNursery lockup.confirmed: ' + transactionHash);
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.emit('transaction', reverseSwap, transactionHash, true, true);
      });
    });

    rskNursery.on('claim', async (reverseSwap, preimage) => {
      this.logger.error('listenRskNursery claim: ');
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.settleReverseSwapInvoice(reverseSwap, preimage);
      });
    });

    await rskNursery.init();
  }

  private listenStacksNursery = async (stacksNursery: StacksNursery) => {
    const contractHandler = this.walletManager.stacksManager!.contractHandler;

    // Swap events
    stacksNursery.on('swap.expired', async (swap) => {
      this.logger.error('stacksNursery swap.expired ');
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.expireSwap(swap);
      });
    });

    stacksNursery.on('lockup.failed', async (swap, reason) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        await this.lockupFailed(swap, reason);
      });
    });

    stacksNursery.on('eth.lockup', async (swap, transactionHash, etherSwapValues) => {
      this.logger.error('listenStacksNursery eth.lockup: ' + transactionHash);
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, false);

        if (swap.invoice) {
          this.logger.error('swapnursery.670 triggering claimstx!');
          await this.claimStx(contractHandler, swap, etherSwapValues);
        } else if (swap.claimAddress) {
          this.logger.error('swapnursery.670 triggering lockutxo?!!');
          const { base, quote } = splitPairId(swap.pair);
          const chainSymbol = getChainCurrency(base, quote, swap.orderSide, true);
          // const lightningSymbol = getLightningCurrency(base, quote, swap.orderSide, true);

          const chainCurrency = this.currencies.get(chainSymbol)!;
          // const { lndClient } = this.currencies.get(lightningSymbol)!;

          const wallet = this.walletManager.wallets.get(chainSymbol)!;
          // this.logger.verbose('swapnursery.732 transaction wallet ' + JSON.stringify(wallet));
          console.log('sn.733 on transaction trigger lockuputxoswap ', base, quote, chainSymbol); //swap
          await this.lockupUtxoSwap(
            chainCurrency.chainClient!,
            // this.walletManager.wallets.get(chainSymbol)!,
            wallet,
            // lndClient!,
            swap
          );
          // user locked onchain stx, we should lock utxo to claimaddress
          // await this.claimStx(contractHandler, swap, etherSwapValues);
        } else {
          this.logger.error('swapnursery.723 triggering setSwapRate!');
          await this.setSwapRate(swap);
        }
      });
    });

    stacksNursery.on('sip10.lockup', async (swap, transactionHash, erc20SwapValues) => {
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, false);

        if (swap.invoice) {
          await this.claimSip10(contractHandler, swap, erc20SwapValues);
        } else if (swap.claimAddress) {
          console.log('stacksn.787 sip10.lockup received, lockutxo!!!');
          const { base, quote } = splitPairId(swap.pair);
          const chainSymbol = getChainCurrency(base, quote, swap.orderSide, true);
          // const lightningSymbol = getLightningCurrency(base, quote, swap.orderSide, true);

          const chainCurrency = this.currencies.get(chainSymbol)!;
          // const { lndClient } = this.currencies.get(lightningSymbol)!;

          const wallet = this.walletManager.wallets.get(chainSymbol)!;
          // this.logger.verbose('swapnursery.732 transaction wallet ' + JSON.stringify(wallet));
          console.log('sn.797 on transaction trigger lockuputxoswap ', base, quote, chainSymbol); //swap
          await this.lockupUtxoSwap(
            chainCurrency.chainClient!,
            // this.walletManager.wallets.get(chainSymbol)!,
            wallet,
            // lndClient!,
            swap
          );
          // user locked onchain stx, we should lock utxo to claimaddress
          // await this.claimStx(contractHandler, swap, etherSwapValues);
        } else {
          await this.setSwapRate(swap);
        }
      });
    });

    // stacksNursery.on('erc20.lockup', async (swap, transactionHash, erc20SwapValues) => {
    //   await this.lock.acquire(SwapNursery.swapLock, async () => {
    //     this.emit('transaction', swap, transactionHash, true, false);

    //     if (swap.invoice) {
    //       await this.claimRskERC20(contractHandler, swap, erc20SwapValues);
    //     } else {
    //       await this.setSwapRate(swap);
    //     }
    //   });
    // });

    // Reverse Swap events
    stacksNursery.on('reverseSwap.expired', async (reverseSwap) => {
      this.logger.error('stacksNursery reverseSwap.expired ');
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        await this.expireReverseSwap(reverseSwap);
      });
    });

    stacksNursery.on('lockup.failedToSend', async (reverseSwap: ReverseSwap, reason ) => {
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        const { base, quote } = splitPairId(reverseSwap.pair);
        const chainSymbol = getChainCurrency(base, quote, reverseSwap.orderSide, true);
        const lightningSymbol = getLightningCurrency(base, quote, reverseSwap.orderSide, true);

        await this.handleReverseSwapSendFailed(
          reverseSwap,
          chainSymbol,
          this.currencies.get(lightningSymbol)!.lndClient!,
          reason);
      });
    });

    stacksNursery.on('lockup.confirmed', async (reverseSwap, transactionHash) => {
      this.logger.error('listenstacksNursery lockup.confirmed event sent but tx not confirmed!: ' + transactionHash);
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.emit('transaction', reverseSwap, transactionHash, true, true);
      });
    });

    stacksNursery.on('astransaction.confirmed', async (swap, transactionHash) => {
      this.logger.error('listenstacksNursery astransaction.confirmed: ' + transactionHash);
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        this.emit('transaction', swap, transactionHash, true, true);
      });
    });

    stacksNursery.on('claim', async (reverseSwap, preimage) => {
      this.logger.error('listenstacksNursery on claim!');
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.logger.error('swapnursery.723 acquire reverseSwapLock: settleReverseSwapInvoice!');
        await this.settleReverseSwapInvoice(reverseSwap, preimage);
      });
    });

    stacksNursery.on('tx.sent', async (reverseSwap, transactionHash) => {
      this.logger.error(`swapnursery.741 tx.sent ${reverseSwap} ${transactionHash}`);
      await this.lock.acquire(SwapNursery.reverseSwapLock, async () => {
        this.emit('transaction', reverseSwap, transactionHash, true, true);
      });
    });

    // atomic swap claim event
    stacksNursery.on('as.claimed', async (swap, transactionHash, preimage) => {
      //trim 0x from preimage
      // const preimage = getHexString(preimage2).slice(2);
      // const transactionHash = transactionHash2.slice(2);
      this.logger.error(`swapnursery.802 as.claimed ${swap} ${transactionHash} ` + getHexString(preimage));
      await this.lock.acquire(SwapNursery.swapLock, async () => {
        // this.emit('transaction', reverseSwap, transactionHash, true, true);
        const chainSymbol = swap.pair.split('/')[0];
        console.log('TODO: dynamic chainSymbol ', chainSymbol);
        const { chainClient } = this.currencies.get(chainSymbol)!;
        const wallet = this.walletManager.wallets.get(chainSymbol)!;

        if (chainClient) {
          try {
            let rawTx;
            // need blockhash because we're running a pruned node with no -txindex
            if((await getInfo()).network_id === 1) {
              const mempoolTx = await transactions.getTx({ txid: transactionHash });
              rawTx = await chainClient.getRawTransactionVerboseBlockHash(transactionHash, mempoolTx.status.block_hash);
            } else {
              // regtest
              rawTx = await chainClient.getRawTransactionVerbose(transactionHash);
            }
               
            const tx = Transaction.fromHex(rawTx.hex);
            console.log('as.claimed tx: ', tx, ' triggering asClaimUtxo');
            await this.asClaimUtxo(chainClient!, wallet, swap, tx, preimage);
          } catch (err) {
            console.log('as.claimed caugh err ', err);
          }

        }

      });
    });

    await stacksNursery.init();
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

      await this.swapRepository.setRate(swap, rate);
    }
  }

  private lockupUtxo = async (
    chainClient: ChainClient,
    wallet: Wallet,
    lndClient: LndClient,
    reverseSwap: ReverseSwap,
  ) => {
    try {
      let feePerVbyte: number;

      if (reverseSwap.minerFeeInvoice) {
        // TODO: how does this behave cross chain
        feePerVbyte = Math.round(decodeInvoice(reverseSwap.minerFeeInvoice).satoshis / FeeProvider.transactionSizes.reverseLockup);
        this.logger.debug(`Using prepay minerfee for lockup of Reverse Swap ${reverseSwap.id}: ${feePerVbyte} sat/vbyte`);
      } else {
        feePerVbyte = await chainClient.estimateFee(SwapNursery.reverseSwapMempoolEta);
      }

      const { transaction, transactionId, vout, fee } = await wallet.sendToAddress(reverseSwap.lockupAddress, reverseSwap.onchainAmount, feePerVbyte);
      this.logger.verbose(`Locked up ${reverseSwap.onchainAmount} ${wallet.symbol} for Reverse Swap ${reverseSwap.id}: ${transactionId}:${vout!}`);

      chainClient.addInputFilter(transaction!.getHash());

      // For the "transaction.confirmed" event of the lockup transaction
      chainClient.addOutputFilter(wallet.decodeAddress(reverseSwap.lockupAddress));

      this.emit('coins.sent', await this.reverseSwapRepository.setLockupTransaction(reverseSwap, transactionId, fee!, vout!), transaction!);
    } catch (error) {
      await this.handleReverseSwapSendFailed(reverseSwap, wallet.symbol, lndClient, error);
    }
  }

  private lockupUtxoSwap = async (
    chainClient: ChainClient,
    wallet: Wallet,
    // lndClient: LndClient,
    swap: Swap,
  ) => {
    try {
      // let feePerVbyte: number;

      // if (reverseSwap.minerFeeInvoice) {
      //   // TODO: how does this behave cross chain
      //   feePerVbyte = Math.round(decodeInvoice(reverseSwap.minerFeeInvoice).satoshis / FeeProvider.transactionSizes.reverseLockup);
      //   this.logger.debug(`Using prepay minerfee for lockup of Reverse Swap ${reverseSwap.id}: ${feePerVbyte} sat/vbyte`);
      // } else {
      const feePerVbyte = await chainClient.estimateFee(SwapNursery.reverseSwapMempoolEta);
      // }

      const amountToSend = Math.floor(swap.quoteAmount! * 100000000);

      const outputScript = getScriptHashFunction(ReverseSwapOutputType)(getHexBuffer(swap.asRedeemScript!));
      const lockupAddress = wallet.encodeAddress(outputScript);

      console.log('lockupUtxoSwap.913 ', swap.claimAddress, amountToSend, feePerVbyte);
      // fee, swap.claimAddress!
      const { transaction, transactionId, vout } = await wallet.sendToAddress(lockupAddress, amountToSend, feePerVbyte);
      this.logger.verbose(`sh.919 lockupUtxoSwap Locked up ${amountToSend} ${wallet.symbol} for Reverse Swap ${swap.id}: ${transactionId}:${vout!} into address ${lockupAddress}`);

      // when blocks are too fast (regtest@10 seconds) -> this is missed?
      // For the "transaction.confirmed" event of the lockup transaction
      chainClient.addOutputFilter(wallet.decodeAddress(lockupAddress));

      // console.log('sn921 not getting transaction.confirmed from chainclient ', transaction!.getHash(), wallet.decodeAddress(lockupAddress));
      chainClient.addInputFilter(transaction!.getHash());

      // fee!,
      this.emit('coins.sent', await this.swapRepository.setLockupTransaction(swap, transactionId, amountToSend, false, vout!), transaction!);
    } catch (error) {
      // await this.handleReverseSwapSendFailed(swap, wallet.symbol, lndClient, error);
      await this.handleSwapSendFailed(swap, wallet.symbol, error);
    }
  }

  private lockupEther = async (
    wallet: Wallet,
    lndClient: LndClient,
    reverseSwap: ReverseSwap,
  ) => {
    try {
      let contractTransaction: ContractTransaction;

      if (reverseSwap.minerFeeOnchainAmount) {
        contractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupEtherPrepayMinerfee(
          getHexBuffer(reverseSwap.preimageHash),
          BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
          BigNumber.from(reverseSwap.minerFeeOnchainAmount).mul(etherDecimals),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      } else {
        contractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupEther(
          getHexBuffer(reverseSwap.preimageHash),
          BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      }

      this.ethereumNursery!.listenContractTransaction(reverseSwap, contractTransaction);
      this.logger.verbose(`Locked up ${reverseSwap.onchainAmount} Ether for Reverse Swap ${reverseSwap.id}: ${contractTransaction.hash}`);

      this.emit(
        'coins.sent',
        await this.reverseSwapRepository.setLockupTransaction(
          reverseSwap,
          contractTransaction.hash,
          calculateEthereumTransactionFee(contractTransaction),
        ),
        contractTransaction.hash,
      );
    } catch (error) {
      await this.handleReverseSwapSendFailed(reverseSwap, wallet.symbol, lndClient, error);
    }
  }

  private lockupERC20 = async (
    wallet: Wallet,
    lndClient: LndClient,
    reverseSwap: ReverseSwap,
  ) => {
    this.logger.error('swapnursery lockuperc20');
    try {
      const walletProvider = wallet.walletProvider as ERC20WalletProvider;

      let contractTransaction: ContractTransaction;

      if (reverseSwap.minerFeeOnchainAmount) {
        contractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupTokenPrepayMinerfee(
          walletProvider,
          getHexBuffer(reverseSwap.preimageHash),
          walletProvider.formatTokenAmount(reverseSwap.onchainAmount),
          BigNumber.from(reverseSwap.minerFeeOnchainAmount).mul(etherDecimals),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      } else {
        this.logger.error('lockuperc20 is called with: walletprovider' + reverseSwap.preimageHash + ', ' + walletProvider.formatTokenAmount(reverseSwap.onchainAmount) + ', ' + reverseSwap.claimAddress! + ', ' + reverseSwap.timeoutBlockHeight);
        contractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupToken(
          walletProvider,
          getHexBuffer(reverseSwap.preimageHash),
          walletProvider.formatTokenAmount(reverseSwap.onchainAmount),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      }

      this.ethereumNursery!.listenContractTransaction(reverseSwap, contractTransaction);
      this.logger.verbose(`Locked up ${reverseSwap.onchainAmount} ${wallet.symbol} for Reverse Swap ${reverseSwap.id}: ${contractTransaction.hash}`);

      this.emit(
        'coins.sent',
        await this.reverseSwapRepository.setLockupTransaction(
          reverseSwap,
          contractTransaction.hash,
          calculateEthereumTransactionFee(contractTransaction),
        ),
        contractTransaction.hash,
      );
    } catch (error) {
      await this.handleReverseSwapSendFailed(reverseSwap, wallet.symbol, lndClient, error);
    }
  }

  private rlockupERC20 = async (
    wallet: Wallet,
    lndClient: LndClient,
    reverseSwap: ReverseSwap,
  ) => {
    this.logger.error('swapnursery rlockuperc20');
    try {
      const walletProvider = wallet.walletProvider as ERC20WalletProvider;

      let contractTransaction: ContractTransaction;

      if (reverseSwap.minerFeeOnchainAmount) {
        contractTransaction = await this.walletManager.rskManager!.contractHandler.lockupTokenPrepayMinerfee(
          walletProvider,
          getHexBuffer(reverseSwap.preimageHash),
          walletProvider.formatTokenAmount(reverseSwap.onchainAmount),
          BigNumber.from(reverseSwap.minerFeeOnchainAmount).mul(etherDecimals),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      } else {
        contractTransaction = await this.walletManager.rskManager!.contractHandler.lockupToken(
          walletProvider,
          getHexBuffer(reverseSwap.preimageHash),
          walletProvider.formatTokenAmount(reverseSwap.onchainAmount),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      }

      this.rskNursery!.listenContractTransaction(reverseSwap, contractTransaction);
      this.logger.verbose(`Locked up ${reverseSwap.onchainAmount} ${wallet.symbol} for Reverse Swap ${reverseSwap.id}: ${contractTransaction.hash}`);

      this.emit(
        'coins.sent',
        await this.reverseSwapRepository.setLockupTransaction(
          reverseSwap,
          contractTransaction.hash,
          calculateRskTransactionFee(contractTransaction),
        ),
        contractTransaction.hash,
      );
    } catch (error) {
      await this.handleReverseSwapSendFailed(reverseSwap, wallet.symbol, lndClient, error);
    }
  }

  private lockupStx = async (
    wallet: Wallet,
    lndClient: LndClient,
    reverseSwap: ReverseSwap,
  ) => {
    try {
      // let oldcontractTransaction: ContractTransaction;
      let contractTransaction: TxBroadcastResult;

      // if (reverseSwap.minerFeeOnchainAmount) {
      //   oldcontractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupEtherPrepayMinerfee(
      //     getHexBuffer(reverseSwap.preimageHash),
      //     BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
      //     BigNumber.from(reverseSwap.minerFeeOnchainAmount).mul(etherDecimals),
      //     reverseSwap.claimAddress!,
      //     reverseSwap.timeoutBlockHeight,
      //   );
      // } else {
        contractTransaction = await this.walletManager.stacksManager!.contractHandler.lockupStx(
          getHexBuffer(reverseSwap.preimageHash),
          BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      // }

      // listenContractTransaction
      this.stacksNursery!.listenStacksContractTransaction(reverseSwap, contractTransaction);
      this.logger.verbose(`Locked up ${reverseSwap.onchainAmount} Stx for Reverse Swap ${reverseSwap.id}: ${contractTransaction.txid}`);

      this.logger.error('swapnursery.943 TODO: add stacks tx fee calculation to setLockupTransaction');
      this.emit(
        'coins.sent',
        await this.reverseSwapRepository.setLockupTransaction(
          reverseSwap,
          contractTransaction.txid,
          // calculateEthereumTransactionFee(contractTransaction),
          1
        ),
        contractTransaction.txid,
      );
    } catch (error) {
      await this.handleReverseSwapSendFailed(reverseSwap, wallet.symbol, lndClient, error);
    }
  }

  // for chain-to-chain atomic swap
  private lockupStxSwap = async (
    wallet: Wallet,
    reverseSwap: Swap,
    lndClient?: LndClient,
  ) => {
    try {
      // let oldcontractTransaction: ContractTransaction;
      let contractTransaction: TxBroadcastResult;

      // console.log('sn.1034 ', reverseSwap);
      // if (reverseSwap.minerFeeOnchainAmount) {
      //   oldcontractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupEtherPrepayMinerfee(
      //     getHexBuffer(reverseSwap.preimageHash),
      //     BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
      //     BigNumber.from(reverseSwap.minerFeeOnchainAmount).mul(etherDecimals),
      //     reverseSwap.claimAddress!,
      //     reverseSwap.timeoutBlockHeight,
      //   );
      // } else {
        if (reverseSwap.asRequestedAmount && reverseSwap.asTimeoutBlockHeight && reverseSwap.onchainAmount && reverseSwap.rate) {
          // nope - it has to be = requestedAmount BUT
          // TODO: check to make sure it's within acceptable range!!!
          const requestedAmount = reverseSwap.asRequestedAmount * 100;
          const calcrequestedAmount = Math.floor(reverseSwap.onchainAmount * 1/reverseSwap.rate);

          // need to map reverseSwap.timeoutBlockHeigh too
          // added asTimeoutBlockHeight to the swap

          // lockupstxswap FOR  8224 200048649 2000547

          if(reverseSwap.tokenAddress) {
            console.log('swapnursery.1220 lockupsip10swap FOR ', reverseSwap.onchainAmount, calcrequestedAmount, requestedAmount);
            const walletProvider = wallet.walletProvider as SIP10WalletProvider;

            contractTransaction = await this.walletManager.stacksManager!.contractHandler.lockupToken(
              walletProvider,
              getHexBuffer(reverseSwap.preimageHash),
              BigNumber.from(requestedAmount).mul(etherDecimals),
              // reverseSwap.claimAddress!,
              reverseSwap.claimAddress!,
              reverseSwap.asTimeoutBlockHeight,
            );
          } else {
            console.log('swapnursery.1239 lockupstxswap FOR ', reverseSwap.onchainAmount, calcrequestedAmount, requestedAmount);
            contractTransaction = await this.walletManager.stacksManager!.contractHandler.lockupStx(
              getHexBuffer(reverseSwap.preimageHash),
              BigNumber.from(requestedAmount).mul(etherDecimals),
              // reverseSwap.claimAddress!,
              reverseSwap.claimAddress!,
              reverseSwap.asTimeoutBlockHeight,
            );
          }

          // listenContractTransaction
          this.stacksNursery!.listenStacksContractTransactionSwap(reverseSwap, contractTransaction);
          this.logger.verbose(`lockupStxSwap up ${requestedAmount} Stx/sip10 for Reverse Swap ${reverseSwap.id}: ${contractTransaction.txid}`);

          this.logger.error('swapnursery.943 lockupStxSwap TODO: add stacks tx fee calculation to setLockupTransaction');
          this.emit(
            'coins.sent',
            await this.swapRepository.setASTransactionConfirmed(
              reverseSwap,
              false,
              undefined,
              undefined,
              contractTransaction.txid,
              // reverseSwap.onchainAmount,
              // requestedAmount,
              // false,
              // calculateEthereumTransactionFee(contractTransaction),
              // 1
            ),
            contractTransaction.txid,
          );
        }

      // }


    } catch (error) {
      // lndClient
      console.log('no lndclient needed here ', lndClient);
      await this.handleSwapSendFailed(reverseSwap, wallet.symbol, error, );
    }
  }

  private lockupToken = async (
    wallet: Wallet,
    lndClient: LndClient,
    reverseSwap: ReverseSwap,
  ) => {
    try {
      // let oldcontractTransaction: ContractTransaction;
      // let contractTransaction: TxBroadcastResult;

      const walletProvider = wallet.walletProvider as SIP10WalletProvider;
      this.logger.verbose('swapnursery.1001 walletProvider ' + JSON.stringify(walletProvider));

      // if (reverseSwap.minerFeeOnchainAmount) {
      //   oldcontractTransaction = await this.walletManager.ethereumManager!.contractHandler.lockupEtherPrepayMinerfee(
      //     getHexBuffer(reverseSwap.preimageHash),
      //     BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
      //     BigNumber.from(reverseSwap.minerFeeOnchainAmount).mul(etherDecimals),
      //     reverseSwap.claimAddress!,
      //     reverseSwap.timeoutBlockHeight,
      //   );
      // } else {
        const contractTransaction = await this.walletManager.stacksManager!.contractHandler.lockupToken(
          walletProvider,
          getHexBuffer(reverseSwap.preimageHash),
          BigNumber.from(reverseSwap.onchainAmount).mul(etherDecimals),
          reverseSwap.claimAddress!,
          reverseSwap.timeoutBlockHeight,
        );
      // }

      // listenContractTransaction
      this.stacksNursery!.listenStacksContractTransaction(reverseSwap, contractTransaction);
      this.logger.verbose(`Locked up ${reverseSwap.onchainAmount} Token for Reverse Swap ${reverseSwap.id}: ${contractTransaction.txid}`);

      this.logger.error('swapnursery.1023 TODO: add stacks tx fee calculation to setLockupTransaction');
      this.emit(
        'coins.sent',
        await this.reverseSwapRepository.setLockupTransaction(
          reverseSwap,
          contractTransaction.txid,
          // calculateEthereumTransactionFee(contractTransaction),
          1
        ),
        contractTransaction.txid,
      );
    } catch (error) {
      await this.handleReverseSwapSendFailed(reverseSwap, wallet.symbol, lndClient, error);
    }
  }

  private claimUtxo = async (
    chainClient: ChainClient,
    wallet: Wallet,
    swap: Swap,
    transaction: Transaction,
    outgoingChannelId?: string,
  ) => {
    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });
    const preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);

    if (!preimage) {
      return;
    }

    const destinationAddress = await wallet.getAddress();

    // Compatibility mode with database schema version 0 in which this column didn't exist
    if (swap.lockupTransactionVout === undefined) {
      swap.lockupTransactionVout = detectSwap(getHexBuffer(swap.redeemScript!), transaction)!.vout;
    }

    const output = transaction.outs[swap.lockupTransactionVout!];

    console.log('constructing claimutxo: ',  {
      preimage,
      vout: swap.lockupTransactionVout!,
      value: output.value,
      script: output.script,
      type: this.swapOutputType,
      txHash: transaction.getHash(),
      keys: wallet.getKeysByIndex(swap.keyIndex!),
      redeemScript: getHexBuffer(swap.redeemScript!),
    });

    const claimTransaction = await constructClaimTransaction(
      [
        {
          preimage,
          vout: swap.lockupTransactionVout!,
          value: output.value,
          script: output.script,
          type: this.swapOutputType,
          txHash: transaction.getHash(),
          keys: wallet.getKeysByIndex(swap.keyIndex!),
          redeemScript: getHexBuffer(swap.redeemScript!),
        }
      ],
      wallet.decodeAddress(destinationAddress),
      await chainClient.estimateFee(),
      true,
    );
    const claimTransactionFee = await calculateUtxoTransactionFee(chainClient, claimTransaction);
    console.log('claim claimtx ', claimTransaction, claimTransaction.toHex());

    await chainClient.sendRawTransaction(claimTransaction.toHex());

    this.logger.info(`Claimed ${wallet.symbol} of Swap ${swap.id} in: ${claimTransaction.getId()}`);

    this.emit(
      'claim',
      await this.swapRepository.setMinerFee(swap, claimTransactionFee),
      channelCreation || undefined,
    );
  }

  // atomic swap
  private asClaimUtxo = async (
    chainClient: ChainClient,
    wallet: Wallet,
    swap: Swap,
    transaction: Transaction,
    preimage: Buffer,
    // outgoingChannelId?: string,
  ) => {
    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });
    // const preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);

    if (!preimage) {
      return;
    }

    const destinationAddress = await wallet.getAddress();
    console.log('asclaimutxo destinationAddress ', destinationAddress);

    // Compatibility mode with database schema version 0 in which this column didn't exist
    if (swap.lockupTransactionVout === undefined) {
      swap.lockupTransactionVout = detectSwap(getHexBuffer(swap.redeemScript!), transaction)!.vout;
    } else {
      const test = detectSwap(getHexBuffer(swap.redeemScript!), transaction)!.vout;
      console.log('vout is there but just confirming ', swap.lockupTransactionVout, test);
    }

    console.log('detectswap: redeemscript inside transaction ', swap.redeemScript,  detectSwap(getHexBuffer(swap.redeemScript!), transaction));
    const output = transaction.outs[swap.lockupTransactionVout!];

    console.log('constructing asclaimutxo: ',  {
      preimage,
      // vout: swap.lockupTransactionVout!,
      vout: 0,
      value: output.value,
      script: output.script,
      type: this.swapOutputType,
      txHash: transaction.getHash(),
      keys: wallet.getKeysByIndex(swap.keyIndex!),
      redeemScript: getHexBuffer(swap.redeemScript!),
    });

    const claimTransaction = await constructClaimTransaction(
      [
        {
          preimage,
          vout: swap.lockupTransactionVout!,
          value: output.value,
          script: output.script,
          type: this.swapOutputType,
          txHash: transaction.getHash(),
          keys: wallet.getKeysByIndex(swap.keyIndex!),
          redeemScript: getHexBuffer(swap.redeemScript!),
        }
      ],
      wallet.decodeAddress(destinationAddress),
      await chainClient.estimateFee(),
      true,
    );
    console.log('asclaim claimtx ', claimTransaction, claimTransaction.toHex());

    const claimTransactionFee = await calculateUtxoTransactionFee(chainClient, claimTransaction);

    await chainClient.sendRawTransaction(claimTransaction.toHex());

    this.logger.info(`asClaimUtxo'ed ${wallet.symbol} of Swap ${swap.id} in: ${claimTransaction.getId()}`);

    this.emit(
      'claim',
      await this.swapRepository.setMinerFee(swap, claimTransactionFee),
      channelCreation || undefined,
    );
  }

  private claimEther = async (contractHandler: ContractHandler, swap: Swap, etherSwapValues: EtherSwapValues, outgoingChannelId?: string) => {
    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });
    const preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);

    if (!preimage) {
      return;
    }

    const contractTransaction = await contractHandler.claimEther(
      preimage,
      etherSwapValues.amount,
      etherSwapValues.refundAddress,
      etherSwapValues.timelock,
    );

    this.logger.info(`Claimed Ether of Swap ${swap.id} in: ${contractTransaction.hash}`);
    this.emit('claim', await this.swapRepository.setMinerFee(swap, calculateEthereumTransactionFee(contractTransaction)), channelCreation || undefined);
  }

  private claimERC20 = async (contractHandler: ContractHandler, swap: Swap, erc20SwapValues: ERC20SwapValues, outgoingChannelId?: string) => {
    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });
    const preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);

    if (!preimage) {
      return;
    }

    const { base, quote } = splitPairId(swap.pair);
    const chainCurrency = getChainCurrency(base, quote, swap.orderSide, false);

    const wallet = this.walletManager.wallets.get(chainCurrency)!;

    const contractTransaction = await contractHandler.claimToken(
      wallet.walletProvider as ERC20WalletProvider,
      preimage,
      erc20SwapValues.amount,
      erc20SwapValues.refundAddress,
      erc20SwapValues.timelock,
    );

    this.logger.info(`Claimed ${chainCurrency} of Swap ${swap.id} in: ${contractTransaction.hash}`);
    this.emit('claim', await this.swapRepository.setMinerFee(swap, calculateEthereumTransactionFee(contractTransaction)), channelCreation || undefined);
  }


  private claimRbtc = async (contractHandler: RskContractHandler, swap: Swap, etherSwapValues: EtherSwapValues, outgoingChannelId?: string) => {
    this.logger.error('claimRbtc triggered');
    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });
    const preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);

    if (!preimage) {
      return;
    }

    const contractTransaction = await contractHandler.claimEther(
      preimage,
      etherSwapValues.amount,
      etherSwapValues.refundAddress,
      etherSwapValues.timelock,
    );

    this.logger.info(`Claimed Rbtc of Swap ${swap.id} in: ${contractTransaction.hash}`);
    this.emit('claim', await this.swapRepository.setMinerFee(swap, calculateRskTransactionFee(contractTransaction)), channelCreation || undefined);
  }

  private claimRskERC20 = async (contractHandler: RskContractHandler, swap: Swap, erc20SwapValues: ERC20SwapValues, outgoingChannelId?: string) => {
    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });
    const preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);

    if (!preimage) {
      return;
    }

    const { base, quote } = splitPairId(swap.pair);
    const chainCurrency = getChainCurrency(base, quote, swap.orderSide, false);

    const wallet = this.walletManager.wallets.get(chainCurrency)!;

    const contractTransaction = await contractHandler.claimToken(
      wallet.walletProvider as ERC20WalletProvider,
      preimage,
      erc20SwapValues.amount,
      erc20SwapValues.refundAddress,
      erc20SwapValues.timelock,
    );

    this.logger.info(`Claimed ${chainCurrency} of Swap ${swap.id} in: ${contractTransaction.hash}`);
    this.emit('claim', await this.swapRepository.setMinerFee(swap, calculateRskTransactionFee(contractTransaction)), channelCreation || undefined);
  }

  private claimStx = async (contractHandler: StacksContractHandler, swap: Swap, etherSwapValues?: EtherSwapValues, outgoingChannelId?: string, detectedPreimage?: string) => {
    this.logger.error('swapnursery.1040 claimStx triggered detectedPreimage? '+ detectedPreimage);
    // add additional check to see if swap expired before paying the invoice
    // happens when app is restarted on mocknet
    const queriedSwap = await this.swapRepository.getSwap({
      id: {
        [Op.eq]: swap.id,
      },
    });
    const latestBlockHeight = (await getInfo()).stacks_tip_height;
    if (queriedSwap!.timeoutBlockHeight <= latestBlockHeight) {
      console.log('can NOT claim, timeout passed!!!');
      return;
    }

    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });

    let preimage, amount, refundAddress, timelock;
    if(!detectedPreimage && etherSwapValues) {
      console.log('swapnursery.1630 paySwapInvoice starting');
      preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);
      amount = etherSwapValues.amount;
      refundAddress = etherSwapValues.refundAddress;
      timelock = etherSwapValues.timelock;
    } else {
      preimage = detectedPreimage;
      amount = (swap.baseAmount! * 1000000).toString(16).padStart(32, '0');
      refundAddress = 'dummyrefundaddress';
      timelock = swap.timeoutBlockHeight;
    }

    if (!preimage) {
      console.log('can NOT claim, no preimage!!!');
      return;
    }

    console.log('swapnursery.1559 triggerin claimStx with preimage, amount, refundAddress, timelock ', preimage, amount, refundAddress, timelock);
    const contractTransaction = await contractHandler.claimEther(
      getHexBuffer(preimage),
      // etherSwapValues.amount,
      amount,
      refundAddress,
      timelock,
    );

    if(contractTransaction.error) {
      this.logger.error(`swapnursery.1165 claimStx error: ${contractTransaction.error}`);
    } else {
      incrementNonce();
    }
    this.logger.info(`Claimed Stx of Swap ${swap.id} in: ${contractTransaction.txid}`);
    this.logger.error('swapnursery.1139 TODO: setminerfee in swaprepository when stacks tx fee calc is available.');
    // calculateRskTransactionFee(contractTransaction)
    this.emit('claim', await this.swapRepository.setMinerFee(swap, 1), channelCreation || undefined);
  }

  private claimSip10 = async (contractHandler: StacksContractHandler, swap: Swap, erc20SwapValues?: ERC20SwapValues, outgoingChannelId?: string, detectedPreimage?: string) => {
    this.logger.error('swapnursery.1240 claimSip10 triggered');

    // add additional check to see if swap expired before paying the invoice
    // happens when app is restarted on mocknet
    const queriedSwap = await this.swapRepository.getSwap({
      id: {
        [Op.eq]: swap.id,
      },
    });
    const latestBlockHeight = (await getInfo()).stacks_tip_height;
    if (queriedSwap!.timeoutBlockHeight <= latestBlockHeight) {
      return;
    }

    const channelCreation = await this.channelCreationRepository.getChannelCreation({
      swapId: {
        [Op.eq]: swap.id,
      },
    });

    let preimage, amount, refundAddress, timelock;
    if(!detectedPreimage && erc20SwapValues) {
      preimage = await this.paySwapInvoice(swap, channelCreation, outgoingChannelId);
      amount = erc20SwapValues.amount;
      refundAddress = erc20SwapValues.refundAddress;
      timelock = erc20SwapValues.timelock;
    } else {
      preimage = getHexBuffer(detectedPreimage!);
      amount = (swap.baseAmount! * 1000000).toString(16).padStart(32, '0');
      refundAddress = 'dummyrefundaddress';
      timelock = swap.timeoutBlockHeight;
    }

    if (!preimage) {
      console.log('swapn.1649 no preimage, not claiming sip10');
      return;
    }

    const { base, quote } = splitPairId(swap.pair);
    const chainCurrency = getChainCurrency(base, quote, swap.orderSide, false);

    const wallet = this.walletManager.wallets.get(chainCurrency)!;

    const contractTransaction = await contractHandler.claimToken(
      wallet.walletProvider as SIP10WalletProvider,
      preimage,
      amount,
      refundAddress,
      timelock,
    );

    if(contractTransaction.error) {
      this.logger.error(`swapnursery.1274 claimSip10 error: ${contractTransaction.error}`);
    } else {
      incrementNonce();
    }
    this.logger.info(`Claimed sip10 of Swap ${swap.id} in: ${contractTransaction.txid}`);
    this.logger.error('swapnursery.1279 TODO: setminerfee in swaprepository when stacks tx fee calc is available.');
    // calculateRskTransactionFee(contractTransaction)
    this.emit('claim', await this.swapRepository.setMinerFee(swap, 1), channelCreation || undefined);
  }

  /**
   * "paySwapInvoice" takes care of paying invoices and handling the errors that can occur by doing that
   * This effectively means logging errors, opening channels and abandoning Swaps
   */
  private paySwapInvoice = async (swap: Swap, channelCreation: ChannelCreation | null, outgoingChannelId?: string): Promise<Buffer | undefined> => {
    this.logger.verbose(`Paying invoice of Swap ${swap.id}`);

    if (swap.status !== SwapUpdateEvent.InvoicePending && swap.status !== SwapUpdateEvent.ChannelCreated) {
      this.emit('invoice.pending', await this.swapRepository.setSwapStatus(swap, SwapUpdateEvent.InvoicePending));
    }

    const setInvoicePaid = async (feeMsat: number) => {
      this.emit('invoice.paid', await this.swapRepository.setInvoicePaid(swap, feeMsat));
    };

    const { base, quote } = splitPairId(swap.pair);
    const lightningSymbol = getLightningCurrency(base, quote, swap.orderSide, false);

    const lightningCurrency = this.currencies.get(lightningSymbol)!;

    try {
      const raceTimeout = LndClient.paymentTimeout * 2;
      const payResponse = await Promise.race([
        lightningCurrency.lndClient!.sendPayment(swap.invoice!, outgoingChannelId),
        new Promise<undefined>((resolve) => {
          setTimeout(() => {
            resolve(undefined);
          }, raceTimeout * 1000);
        }),
      ]);

      if (payResponse !== undefined) {
        this.logger.debug(`Paid invoice of Swap ${swap.id}: ${payResponse.paymentPreimage}`);
        await setInvoicePaid(payResponse.feeMsat);

        return getHexBuffer(payResponse.paymentPreimage);
      } else {
        this.logger.verbose(`Invoice payment of Swap ${swap.id} is still pending after ${raceTimeout} seconds`);
      }
    } catch (error) {
      const errorMessage = typeof error === 'number' ? LndClient.formatPaymentFailureReason(error) : formatError(error);

      if (outgoingChannelId !== undefined) {
        throw errorMessage;
      }

      // Catch cases in which the invoice was paid already
      if (error.code === 6 && error.details === 'invoice is already paid') {
        const payment = await lightningCurrency.lndClient!.trackPayment(getHexBuffer(swap.preimageHash));
        this.logger.debug(`Invoice of Swap ${swap.id} is paid already: ${payment.paymentPreimage}`);
        await setInvoicePaid(payment.feeMsat);

        return getHexBuffer(payment.paymentPreimage);
      }

      this.logger.warn(`Could not pay invoice of Swap ${swap.id} because: ${errorMessage}`);

      // If the recipient rejects the payment or the invoice expired, the Swap will be abandoned
      if (
        error === PaymentFailureReason.FAILURE_REASON_INCORRECT_PAYMENT_DETAILS ||
        errorMessage.includes('invoice expired')
      ) {
        this.logger.warn(`Abandoning Swap ${swap.id} because: ${errorMessage}`);
        this.emit(
          'invoice.failedToPay',
          await this.swapRepository.setSwapStatus(
            swap,
            SwapUpdateEvent.InvoiceFailedToPay,
            Errors.INVOICE_COULD_NOT_BE_PAID().message,
          ),
        );

      // If the invoice could not be paid but the Swap has a Channel Creation attached to it, a channel will be opened
      } else if (
        typeof error === 'number' &&
        channelCreation &&
        channelCreation.status !== ChannelCreationStatus.Created
      ) {
        switch (error) {
          case PaymentFailureReason.FAILURE_REASON_TIMEOUT:
          case PaymentFailureReason.FAILURE_REASON_NO_ROUTE:
          case PaymentFailureReason.FAILURE_REASON_INSUFFICIENT_BALANCE:
            // TODO: !formattedError.startsWith('unable to route payment to destination: UnknownNextPeer')
            await this.channelNursery.openChannel(lightningCurrency, swap, channelCreation);
        }
      }
    }

    return;
  }

  private settleReverseSwapInvoice = async (reverseSwap: ReverseSwap, preimage: Buffer) => {
    const { base, quote } = splitPairId(reverseSwap.pair);
    const lightningCurrency = getLightningCurrency(base, quote, reverseSwap.orderSide, true);

    const { lndClient } = this.currencies.get(lightningCurrency)!;
    await lndClient!.settleInvoice(preimage);

    this.logger.info(`Settled Reverse Swap ${reverseSwap.id}`);

    this.emit('invoice.settled', await this.reverseSwapRepository.setInvoiceSettled(reverseSwap, getHexString(preimage)));
  }

  private handleReverseSwapSendFailed = async (reverseSwap: ReverseSwap, chainSymbol: string, lndClient: LndClient, error: unknown) => {
    await lndClient.cancelInvoice(getHexBuffer(reverseSwap.preimageHash));

    this.logger.warn(`Failed to lockup ${reverseSwap.onchainAmount} ${chainSymbol} for Reverse Swap ${reverseSwap.id}: ${formatError(error)}`);
    this.emit('coins.failedToSend', await this.reverseSwapRepository.setReverseSwapStatus(
      reverseSwap,
      SwapUpdateEvent.TransactionFailed,
      Errors.COINS_COULD_NOT_BE_SENT().message,
    ));
  }

  private handleSwapSendFailed = async (reverseSwap: Swap, chainSymbol: string, error: unknown,) => {
    // lndClient?: LndClient,
    // await lndClient.cancelInvoice(getHexBuffer(reverseSwap.preimageHash));
    console.log('sn.1697 handleswap failed ', error);
    this.logger.warn(`Failed to lockup ${reverseSwap.onchainAmount} ${chainSymbol} for Reverse Swap ${reverseSwap.id}: ${formatError(error)}`);
    this.emit('coins.failedToSend', await this.swapRepository.setSwapStatus(
      reverseSwap,
      SwapUpdateEvent.TransactionFailed,
      Errors.COINS_COULD_NOT_BE_SENT().message,
    ));
  }

  private lockupFailed = async (swap: Swap, reason: string) => {
    this.logger.warn(`Lockup of Swap ${swap.id} failed: ${reason}`);
    this.emit('lockup.failed', await this.swapRepository.setSwapStatus(swap, SwapUpdateEvent.TransactionLockupFailed, reason));
  }

  private expireSwap = async (swap: Swap) =>  {
    // Check "expireReverseSwap" for reason
    const queriedSwap = await this.swapRepository.getSwap({
      id: {
        [Op.eq]: swap.id,
      },
    });

    if (queriedSwap!.status === SwapUpdateEvent.SwapExpired || queriedSwap!.status === SwapUpdateEvent.TransactionRefunded ) {
      // refunded added to avoid 2 x refundutxoAS
      this.logger.verbose('swapnursery expireSwap returning without refunding '+ swap.id);
      return;
    }

    this.logger.verbose('swapnursery expireSwap continues'+ swap.id);

    // check if there's any atomic swap refund to be done
    if (swap.asLockupTransactionId) {
      if(swap.contractAddress) {
        if(swap.tokenAddress) {
          console.log('swapn.1854 refund expired sip10 swap ', swap.id);
          this.refundSip10AS(swap, 'USDA');
        } else {
          console.log('swapn.1863 refund expired STX swap ', swap.id);
          this.refundStxAS(swap);
        }
      } else {
        console.log('swapn.1867 refund expired BTC swap ', swap.id);
        this.refundUtxoAS(swap, 'BTC');
      }

    }

    this.emit(
      'expiration',
      await this.swapRepository.setSwapStatus(swap, SwapUpdateEvent.SwapExpired, Errors.ONCHAIN_HTLC_TIMED_OUT().message),
      false,
    );
  }

  private expireReverseSwap = async (reverseSwap: ReverseSwap) => {
    // Sometimes, when blocks are mined quickly (realistically just regtest), it can happen that the
    // nurseries, which are not in the async lock, send the expiration event of a Swap multiple times.
    // To handle this scenario, the Swap is queried again to ensure that it should actually be expired or refunded
    const queriedReverseSwap = await this.reverseSwapRepository.getReverseSwap({
      id: {
        [Op.eq]: reverseSwap.id,
      },
    });

    if (queriedReverseSwap!.status === SwapUpdateEvent.SwapExpired || queriedReverseSwap!.status === SwapUpdateEvent.TransactionRefunded) {
      return;
    }

    const { base, quote } = splitPairId(reverseSwap.pair);
    const chainSymbol = getChainCurrency(base, quote, reverseSwap.orderSide, true);
    const lightningSymbol = getLightningCurrency(base, quote, reverseSwap.orderSide, true);

    const chainCurrency = this.currencies.get(chainSymbol)!;
    const lightningCurrency = this.currencies.get(lightningSymbol)!;

    // added to avoid refunding lock txns stuck in mempool - stacks issue
    if (reverseSwap.transactionId && queriedReverseSwap!.status !== SwapUpdateEvent.TransactionMempool) {
      this.logger.error('swapnursery.1336 reverseSwap.transactionId ' + chainCurrency.type + ', ' + chainSymbol);
      switch (chainCurrency.type) {
        case CurrencyType.BitcoinLike:
          await this.refundUtxo(reverseSwap, chainSymbol);
          break;

        case CurrencyType.Ether:
          await this.refundEther(reverseSwap);
          break;

        case CurrencyType.ERC20:
          this.logger.error('refunderc20 for ' + chainSymbol);
          if(chainSymbol == 'SOV') {
            await this.rrefundERC20(reverseSwap, chainSymbol);
          } else {
            await this.refundERC20(reverseSwap, chainSymbol);
          }
          break;

        case CurrencyType.Stx:
          await this.refundStx(reverseSwap);
          break;

        case CurrencyType.Sip10:
          await this.refundSip10(reverseSwap, chainSymbol);
          break;
      }
    } else {
      this.logger.error('swapnursery emitting htlc timeout');
      this.emit(
        'expiration',
        await this.reverseSwapRepository.setReverseSwapStatus(
          reverseSwap,
          SwapUpdateEvent.SwapExpired,
          Errors.ONCHAIN_HTLC_TIMED_OUT().message,
        ),
        true,
      );
    }

    await lightningCurrency.lndClient!.cancelInvoice(getHexBuffer(reverseSwap.preimageHash));

    if (reverseSwap.minerFeeInvoicePreimage) {
      await lightningCurrency.lndClient!.cancelInvoice(crypto.sha256(getHexBuffer(reverseSwap.minerFeeInvoicePreimage)));
    }
  }

  private refundUtxo = async (reverseSwap: ReverseSwap, chainSymbol: string) => {
    const chainCurrency = this.currencies.get(chainSymbol)!;
    const wallet = this.walletManager.wallets.get(chainSymbol)!;

    this.logger.info('swapnursery.1976 refundUtxo getRawTransaction');
    // const rawLockupTransaction = await chainCurrency.chainClient!.getRawTransaction(reverseSwap.transactionId!);

    // need blockhash because we're running a pruned node with no -txindex
    let rawLockupTransaction;
    if((await getInfo()).network_id === 1) {
      const mempoolTx = await transactions.getTx({ txid: reverseSwap.transactionId! });
      rawLockupTransaction = await chainCurrency.chainClient!.getRawTransactionBlockHash(reverseSwap.transactionId!, mempoolTx.status.block_hash);
    } else {
      // regtest
      rawLockupTransaction = await chainCurrency.chainClient!.getRawTransaction(reverseSwap.transactionId!);
    }
    const lockupTransaction = Transaction.fromHex(rawLockupTransaction);

    const lockupOutput = lockupTransaction.outs[reverseSwap.transactionVout!];

    const destinationAddress = await wallet.getAddress();
    const refundTransaction = constructRefundTransaction(
      [{
        ...lockupOutput,
        type: ReverseSwapOutputType,
        vout: reverseSwap.transactionVout!,
        txHash: lockupTransaction.getHash(),
        keys: wallet.getKeysByIndex(reverseSwap.keyIndex!),
        redeemScript: getHexBuffer(reverseSwap.redeemScript!),
      }],
      wallet.decodeAddress(destinationAddress),
      reverseSwap.timeoutBlockHeight,
      await chainCurrency.chainClient!.estimateFee(),
    );
    const minerFee = await calculateUtxoTransactionFee(chainCurrency.chainClient!, refundTransaction);

    await chainCurrency.chainClient!.sendRawTransaction(refundTransaction.toHex());

    this.logger.info(`Refunded ${chainSymbol} of Reverse Swap ${reverseSwap.id} in: ${refundTransaction.getId()}`);
    this.emit(
      'refund',
      await this.reverseSwapRepository.setTransactionRefunded(reverseSwap, minerFee, Errors.REFUNDED_COINS(reverseSwap.transactionId!).message),
      refundTransaction.getId(),
    );
  }

  private refundUtxoAS = async (reverseSwap: Swap, chainSymbol: string) => {
    const chainCurrency = this.currencies.get(chainSymbol)!;
    const wallet = this.walletManager.wallets.get(chainSymbol)!;

    this.logger.info('swapnursery.1976 refundUtxoAS getRawTransaction');
    // const rawLockupTransaction = await chainCurrency.chainClient!.getRawTransaction(reverseSwap.asLockupTransactionId!);

    // need blockhash because we're running a pruned node with no -txindex
    let rawLockupTransaction;
    if((await getInfo()).network_id === 1) {
      const mempoolTx = await transactions.getTx({ txid: reverseSwap.asLockupTransactionId! });
      rawLockupTransaction = await chainCurrency.chainClient!.getRawTransactionBlockHash(reverseSwap.asLockupTransactionId!, mempoolTx.status.block_hash);
    } else {
      // regtest
      rawLockupTransaction = await chainCurrency.chainClient!.getRawTransaction(reverseSwap.asLockupTransactionId!);
    }

    const lockupTransaction = Transaction.fromHex(rawLockupTransaction);

    const lockupOutput = lockupTransaction.outs[reverseSwap.lockupTransactionVout!];

    const destinationAddress = await wallet.getAddress();
    console.log('swapn.1983 refundUtxoAS ', reverseSwap.asLockupTransactionId!, lockupOutput, reverseSwap.keyIndex!, )
    const refundTransaction = constructRefundTransaction(
      [{
        ...lockupOutput,
        type: ReverseSwapOutputType,
        vout: reverseSwap.lockupTransactionVout!,
        txHash: lockupTransaction.getHash(),
        keys: wallet.getKeysByIndex(reverseSwap.keyIndex!),
        redeemScript: getHexBuffer(reverseSwap.redeemScript!),
      }],
      wallet.decodeAddress(destinationAddress),
      // reverseSwap.timeoutBlockHeight,
      reverseSwap.asTimeoutBlockHeight!,
      await chainCurrency.chainClient!.estimateFee(),
    );
    // const minerFee = await calculateUtxoTransactionFee(chainCurrency.chainClient!, refundTransaction);

    await chainCurrency.chainClient!.sendRawTransaction(refundTransaction.toHex());

    this.logger.info(`Refunded ${chainSymbol} of Reverse Swap ${reverseSwap.id} in: ${refundTransaction.getId()}`);
    this.emit(
      'refund',
      await this.swapRepository.setTransactionRefunded(reverseSwap, Errors.REFUNDED_COINS(reverseSwap.asLockupTransactionId!).message),
      refundTransaction.getId(),
    );
    // minerFee
  }

  private refundEther = async (reverseSwap: ReverseSwap) => {
    const ethereumManager = this.walletManager.ethereumManager!;

    const etherSwapValues = await queryEtherSwapValuesFromLock(ethereumManager.etherSwap, reverseSwap.transactionId!);
    const contractTransaction = await ethereumManager.contractHandler.refundEther(
      getHexBuffer(reverseSwap.preimageHash),
      etherSwapValues.amount,
      etherSwapValues.claimAddress,
      etherSwapValues.timelock,
    );

    this.logger.info(`Refunded Ether of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.hash}`);
    this.emit(
      'refund',
      await this.reverseSwapRepository.setTransactionRefunded(
        reverseSwap,
        calculateEthereumTransactionFee(contractTransaction),
        Errors.REFUNDED_COINS(reverseSwap.transactionId!).message,
      ),
      contractTransaction.hash,
    );
  }

  private refundStx = async (reverseSwap: ReverseSwap) => {
    const stacksManager = this.walletManager.stacksManager!;

    // const etherSwapValues = await queryEtherSwapValuesFromLock(ethereumManager.etherSwap, reverseSwap.transactionId!);
    const etherSwapValues = await querySwapValuesFromTx(reverseSwap.transactionId!);
    const contractTransaction:TxBroadcastResult = await stacksManager.contractHandler.refundStx(
      getHexBuffer(reverseSwap.preimageHash),
      etherSwapValues.amount,
      etherSwapValues.claimAddress,
      etherSwapValues.timelock,
    );

    if(!contractTransaction.error) {
      incrementNonce();
    }

    // this tx contractTransaction may fail in the future - need to handle somehow
    // for instance it failed because claimstx got in first

    this.logger.info(`Refunded STX of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.txid}`);
    this.emit(
      'refund',
      await this.reverseSwapRepository.setTransactionRefunded(
        reverseSwap,
        // calculateEthereumTransactionFee(contractTransaction),
        0,
        Errors.REFUNDED_COINS(reverseSwap.transactionId!).message,
      ),
      contractTransaction.txid,
    );
  }

  private refundStxAS = async (reverseSwap: Swap) => {
    const stacksManager = this.walletManager.stacksManager!;

    // const etherSwapValues = await queryEtherSwapValuesFromLock(ethereumManager.etherSwap, reverseSwap.transactionId!);
    const etherSwapValues = await querySwapValuesFromTx(reverseSwap.asLockupTransactionId!);
    const contractTransaction:TxBroadcastResult = await stacksManager.contractHandler.refundStx(
      getHexBuffer(reverseSwap.preimageHash),
      etherSwapValues.amount,
      etherSwapValues.claimAddress,
      etherSwapValues.timelock,
    );

    if(!contractTransaction.error) {
      incrementNonce();
    }

    // this tx contractTransaction may fail in the future - need to handle somehow
    // for instance it failed because claimstx got in first

    this.logger.info(`Refunded STX of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.txid}`);
    this.emit(
      'refund',
      await this.swapRepository.setTransactionRefunded(
        reverseSwap,
        // calculateEthereumTransactionFee(contractTransaction),
        // 0,
        Errors.REFUNDED_COINS(reverseSwap.asLockupTransactionId!).message,
      ),
      contractTransaction.txid,
    );
  }

  private refundSip10 = async (reverseSwap: ReverseSwap, chainSymbol: string) => {
    const stacksManager = this.walletManager.stacksManager!;
    const walletProvider = this.walletManager.wallets.get(chainSymbol)!.walletProvider as SIP10WalletProvider;

    // const etherSwapValues = await queryEtherSwapValuesFromLock(ethereumManager.etherSwap, reverseSwap.transactionId!);
    const etherSwapValues = await querySip10SwapValuesFromTx(reverseSwap.transactionId!);
    const contractTransaction:TxBroadcastResult = await stacksManager.contractHandler.refundToken(
      walletProvider,
      getHexBuffer(reverseSwap.preimageHash),
      etherSwapValues.amount,
      etherSwapValues.claimAddress,
      etherSwapValues.timelock,
    );

    if(!contractTransaction.error) {
      incrementNonce();
    }

    // this tx contractTransaction may fail in the future - need to handle somehow
    // for instance it failed because claimstx got in first

    this.logger.info(`Refunded Sip10 of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.txid}`);
    this.emit(
      'refund',
      await this.reverseSwapRepository.setTransactionRefunded(
        reverseSwap,
        // calculateEthereumTransactionFee(contractTransaction),
        0,
        Errors.REFUNDED_COINS(reverseSwap.transactionId!).message,
      ),
      contractTransaction.txid,
    );
  }

  private refundSip10AS = async (reverseSwap: Swap, chainSymbol: string) => {
    const stacksManager = this.walletManager.stacksManager!;
    const walletProvider = this.walletManager.wallets.get(chainSymbol)!.walletProvider as SIP10WalletProvider;

    // const etherSwapValues = await queryEtherSwapValuesFromLock(ethereumManager.etherSwap, reverseSwap.transactionId!);
    const etherSwapValues = await querySip10SwapValuesFromTx(reverseSwap.asLockupTransactionId!);
    const contractTransaction:TxBroadcastResult = await stacksManager.contractHandler.refundToken(
      walletProvider,
      getHexBuffer(reverseSwap.preimageHash),
      etherSwapValues.amount,
      etherSwapValues.claimAddress,
      etherSwapValues.timelock,
    );

    if(!contractTransaction.error) {
      incrementNonce();
    }

    // this tx contractTransaction may fail in the future - need to handle somehow
    // for instance it failed because claimstx got in first

    this.logger.info(`Refunded Sip10 of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.txid}`);
    this.emit(
      'refund',
      await this.swapRepository.setTransactionRefunded(
        reverseSwap,
        // calculateEthereumTransactionFee(contractTransaction),
        // 0,
        Errors.REFUNDED_COINS(reverseSwap.asLockupTransactionId!).message,
      ),
      contractTransaction.txid,
    );
  }

  private refundERC20 = async (reverseSwap: ReverseSwap, chainSymbol: string) => {
    this.logger.error('eth refundERC20');
    const ethereumManager = this.walletManager.ethereumManager!;
    const walletProvider = this.walletManager.wallets.get(chainSymbol)!.walletProvider as ERC20WalletProvider;

    const erc20SwapValues = await queryERC20SwapValuesFromLock(ethereumManager.erc20Swap, reverseSwap.transactionId!);
    const contractTransaction = await ethereumManager.contractHandler.refundToken(
      walletProvider,
      getHexBuffer(reverseSwap.preimageHash),
      erc20SwapValues.amount,
      erc20SwapValues.claimAddress,
      erc20SwapValues.timelock,
    );

    this.logger.info(`Refunded ${chainSymbol} of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.hash}`);
    this.emit(
      'refund',
      await this.reverseSwapRepository.setTransactionRefunded(
        reverseSwap,
        calculateEthereumTransactionFee(contractTransaction),
        Errors.REFUNDED_COINS(reverseSwap.transactionId!).message,
      ),
      contractTransaction.hash,
    );
  }

  private rrefundERC20 = async (reverseSwap: ReverseSwap, chainSymbol: string) => {
    this.logger.error('rsk refundERC20');
    const ethereumManager = this.walletManager.rskManager!;
    const walletProvider = this.walletManager.wallets.get(chainSymbol)!.walletProvider as ERC20WalletProvider;

    const erc20SwapValues = await queryERC20SwapValuesFromLock(ethereumManager.erc20Swap, reverseSwap.transactionId!);
    const contractTransaction = await ethereumManager.contractHandler.refundToken(
      walletProvider,
      getHexBuffer(reverseSwap.preimageHash),
      erc20SwapValues.amount,
      erc20SwapValues.claimAddress,
      erc20SwapValues.timelock,
    );

    this.logger.info(`Refunded ${chainSymbol} of Reverse Swap ${reverseSwap.id} in: ${contractTransaction.hash}`);
    this.emit(
      'refund',
      await this.reverseSwapRepository.setTransactionRefunded(
        reverseSwap,
        calculateRskTransactionFee(contractTransaction),
        Errors.REFUNDED_COINS(reverseSwap.transactionId!).message,
      ),
      contractTransaction.hash,
    );
  }
}

export default SwapNursery;
