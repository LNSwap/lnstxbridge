import { EventEmitter } from 'events';
import { Transaction } from 'bitcoinjs-lib';
import Logger from '../Logger';
import Swap from '../db/models/Swap';
import SwapNursery from '../swap/SwapNursery';
import { SwapUpdateEvent } from '../consts/Enums';
import ReverseSwap from '../db/models/ReverseSwap';
import { Currency } from '../wallet/WalletManager';
import ChannelCreation from '../db/models/ChannelCreation';
import { stringify } from '../../lib/Utils';

type TransactionInfo = {
  eta?: number;

  id: string;
  hex?: string;
};

type SwapUpdate = {
  status: SwapUpdateEvent;
  failureReason?: string;

  zeroConfRejected?: boolean;
  transaction?: TransactionInfo;

  channel?: {
    fundingTransactionId: string;
    fundingTransactionVout: number;
  },
};

interface EventHandler {
  on(event: 'swap.update', listener: (id: string, message: SwapUpdate) => void): this;
  emit(event: 'swap.update', id: string, message: SwapUpdate): boolean;

  on(event: 'swap.success', listener: (swap: Swap | ReverseSwap, isReverse: boolean, channelCreation?: ChannelCreation) => void): this;
  emit(event: 'swap.success', swap: Swap | ReverseSwap, isReverse: boolean, channelCreation?: ChannelCreation): boolean;

  on(event: 'swap.failure', listener: (reverseSwap: Swap | ReverseSwap, isReverse: boolean, reason: string) => void): this;
  emit(event: 'swap.failure', reverseSwap: Swap | ReverseSwap, isReverse: boolean, reason: string): boolean;

  on(event: 'channel.backup', listener: (currency: string, channelBackup: string) => void): this;
  emit(event: 'channel.backup', currency: string, channelBackup: string): boolean;
}

class EventHandler extends EventEmitter {
  constructor(
    private logger: Logger,
    private currencies: Map<string, Currency>,
    private nursery: SwapNursery,
  ) {
    super();

    this.subscribeInvoices();
    this.subscribeSwapEvents();
    this.subscribeTransactions();
    this.subscribeChannelBackups();
  }

  public emitSwapCreation = (id: string): void => {
    this.emit('swap.update', id, { status: SwapUpdateEvent.SwapCreated });
  }

  public emitSwapInvoiceSet = (id: string): void => {
    this.emit('swap.update', id, { status: SwapUpdateEvent.InvoiceSet });
  }

  /**
   * Subscribes transaction related swap events
   */
  private subscribeTransactions = () => {
    this.nursery.on('transaction', (swap, transaction, confirmed, isReverse) => {
      this.logger.verbose('eventhandler.72 on transaction: ' + stringify(swap) + ', ' + transaction + ', ' + confirmed + ' , ' + isReverse);
      if (!isReverse) {
        this.logger.verbose('eventhandler.74 on transaction: '+ confirmed);
        // asconfirmed will be sent after btc (as tx) is confirmed - removing from here
        // I need this for btc -> stx? - btc confirmed!
        if(swap['asRedeemScript']) {
          console.log('eth.79');
          // stx -> BTC atomic swap - stx confirmed
          this.emit('swap.update', swap.id, {
            status: confirmed ? SwapUpdateEvent.ASTransactionConfirmed : SwapUpdateEvent.ASTransactionMempool,
          });
        } else {
          // triggers for onchain stx -> btc swap on btc tx
          console.log('eh.85');
          this.emit('swap.update', swap.id, {
            status: confirmed ? SwapUpdateEvent.TransactionConfirmed : SwapUpdateEvent.TransactionMempool,
          });
        }

      } else {
        // Reverse Swaps only emit the "transaction.confirmed" event
        // "transaction.mempool" is handled by the event "coins.sent"
        if (transaction instanceof Transaction) {
          this.logger.verbose('eventhandler.82 on transaction: ');
          this.emit('swap.update', swap.id, {
            status: SwapUpdateEvent.TransactionConfirmed,
            transaction: {
              id: transaction.getId(),
              hex: transaction.toHex(),
            },
          });
        } else if ((confirmed && swap.status == 'transaction.confirmed') || (confirmed && swap.status == 'astransaction.confirmed')) {
          // asRequestedAmount?
          if (swap.claimAddress && !swap.invoice) {
            // for atomic swap this gets triggered for AStransaction.confirmed
            this.logger.verbose(`eventhandler.95 on transaction: ${transaction}`);
            this.emit('swap.update', swap.id, {
              status: SwapUpdateEvent.ASTransactionConfirmed,
              transaction: {
                id: transaction.toString(),
                // hex: transaction.toHex(),
              },
            });
          } else {
            // for stacks tx.sent event from stacksnursery -> swapnursery -> here
            this.logger.verbose(`eventhandler.105 on transaction: ${transaction}`);
            this.emit('swap.update', swap.id, {
              status: SwapUpdateEvent.TransactionConfirmed,
              transaction: {
                id: transaction.toString(),
                // hex: transaction.toHex(),
              },
            });
          }

       } else {
         this.logger.verbose('eventhandler.104 transaction NOT confirmed yet');
       }

        // removing this because otherwise stacks tx is marked as confirmed as soon as coins.sent
        // this is moved to swapnursery listenstackstx
        // else {
        //   this.logger.error("eventhandler.91 on transaction: " + stringify(transaction));
        //   this.emit('swap.update', swap.id, {
        //     status: SwapUpdateEvent.TransactionConfirmed,
        //     transaction: {
        //       id: transaction,
        //     },
        //   });
        // }
      }
    });

    // this.nursery.on('tx.sent', (swap, transaction) => {
    //   this.logger.error("eventhandler.91 on transaction: " + stringify(transaction));
    //   this.emit('swap.update', swap.id, {
    //     status: SwapUpdateEvent.TransactionConfirmed,
    //     transaction: {
    //       id: transaction,
    //     },
    //   });
    // });
  }

  /**
   * Subscribes to invoice related Swap events
   */
  private subscribeInvoices = () => {
    this.nursery.on('invoice.settled', (swap) => {
      this.logger.verbose(`Reverse swap ${swap.id} succeeded`);

      this.emit('swap.update', swap.id, { status: SwapUpdateEvent.InvoiceSettled });
      this.emit('swap.success', swap, true);
    });

    this.nursery.on('invoice.pending', (swap) => {
      this.emit('swap.update', swap.id, { status: SwapUpdateEvent.InvoicePending });
    });

    this.nursery.on('invoice.failedToPay', (swap) => {
      this.handleFailedSwap(swap, SwapUpdateEvent.InvoiceFailedToPay, swap.failureReason!);
    });

    this.nursery.on('invoice.paid', (swap) => {
      this.emit('swap.update', swap.id, { status: SwapUpdateEvent.InvoicePaid });
    });

    this.nursery.on('invoice.expired', (reverseSwap: ReverseSwap) => {
      this.emit('swap.update', reverseSwap.id, {  status: SwapUpdateEvent.InvoiceExpired });
    });
  }

  /**
   * Subscribes Swap events
   */
  private subscribeSwapEvents = () => {
    this.nursery.on('zeroconf.rejected', (swap) => {
      this.emit('swap.update', swap.id, {
        status: SwapUpdateEvent.TransactionMempool,
        zeroConfRejected: true,
      });
    });

    this.nursery.on('claim', (swap, channelCreation) => {
      this.logger.verbose(`Swap ${swap.id} succeeded`);

      this.emit('swap.update', swap.id, { status: SwapUpdateEvent.TransactionClaimed });
      this.emit('swap.success', swap, false, channelCreation);
    });

    this.nursery.on('expiration', (swap, isReverse) => {
      const newStatus = SwapUpdateEvent.SwapExpired;

      if (isReverse) {
        this.handleFailedReverseSwap(swap as ReverseSwap, newStatus, swap.failureReason!);
      } else {
        this.handleFailedSwap(swap as Swap, newStatus, swap.failureReason!);
      }
    });

    this.nursery.on('minerfee.paid', (reverseSwap) => {
      this.emit('swap.update', reverseSwap.id, {
        status: SwapUpdateEvent.MinerFeePaid,
      });
    });

    this.nursery.on('coins.sent', (reverseSwap, transaction) => {
      this.logger.verbose('eventhandler.166 on coins.sent: ' + stringify(reverseSwap));

      if (transaction instanceof Transaction) {
        this.logger.verbose('eventhandler.168 on coins.sent: ');
        if(reverseSwap['asRedeemScript']) {
          this.logger.verbose('eventhandler.222 swap.update ASTransactionMempool on coins.sent: ');
          this.emit('swap.update', reverseSwap.id, {
            status: SwapUpdateEvent.ASTransactionMempool,
            transaction: {
              id: transaction.getId(),
              hex: transaction.toHex(),
              eta: SwapNursery.reverseSwapMempoolEta,
            },
          });
        } else {
          this.emit('swap.update', reverseSwap.id, {
            status: SwapUpdateEvent.TransactionMempool,
            transaction: {
              id: transaction.getId(),
              hex: transaction.toHex(),
              eta: SwapNursery.reverseSwapMempoolEta,
            },
          });
        }

      } else {
        this.logger.verbose('eventhandler.178 on coins.sent: ');
        // check if this was AStransaction
        if (reverseSwap.claimAddress && reverseSwap['asRequestedAmount']) {
          console.log('eh.210 ');
          this.emit('swap.update', reverseSwap.id, {
            status: SwapUpdateEvent.ASTransactionMempool,
            transaction: {
              id: transaction,
            },
          });
        } else {
          this.emit('swap.update', reverseSwap.id, {
            status: SwapUpdateEvent.TransactionMempool,
            transaction: {
              id: transaction,
            },
          });
        }

      }
    });

    this.nursery.on('astransaction.confirmed', (swap, transaction, preimage) => {
      this.logger.verbose('eventhandler.266 on astransaction.confirmed: ' + stringify(swap));
      if(!preimage) {
        let id = '';
        let hex = '';
        if (typeof transaction !== 'string') {
          id = transaction.getId();
          hex = transaction.toHex();
        }
        this.emit('swap.update', swap.id, {
          status: SwapUpdateEvent.ASTransactionConfirmed,
          transaction: {
            id,
            hex,
          },
        });
      }
    });

    this.nursery.on('transaction.claimed', (swap) => {
      this.logger.verbose('eventhandler.288 on astransaction.claimed: ' + swap);
      this.emit('swap.update', swap.id, {
        status: SwapUpdateEvent.TransactionClaimed,
      });
    });

    this.nursery.on('coins.failedToSend', (reverseSwap) => {
      this.handleFailedReverseSwap(reverseSwap, SwapUpdateEvent.TransactionFailed, reverseSwap.failureReason!);
    });

    this.nursery.on('refund', (reverseSwap) => {
      this.handleFailedReverseSwap(reverseSwap, SwapUpdateEvent.TransactionRefunded, reverseSwap.failureReason!);
    });

    this.nursery.channelNursery.on('channel.created', (swap, channelCreation) => {
      this.emit('swap.update', swap.id, {
        status: SwapUpdateEvent.ChannelCreated,
        channel: {
          fundingTransactionId: channelCreation.fundingTransactionId!,
          fundingTransactionVout: channelCreation.fundingTransactionVout!,
        },
      });
    });

    this.nursery.on('lockup.failed', (swap: Swap) => {
      this.emit('swap.update', swap.id, {
        status: SwapUpdateEvent.TransactionLockupFailed,
        failureReason: swap.failureReason,
      });
    });
  }

  /**
   * Subscribes to a stream of channel backups
   */
  private subscribeChannelBackups = () => {
    this.currencies.forEach((currency) => {
      if (currency.lndClient) {
        const { symbol, lndClient } = currency;

        lndClient.on('channel.backup', (channelBackup: string) => {
          this.emit('channel.backup', symbol, channelBackup);
        });
      }
    });
  }

  private handleFailedSwap = (swap: Swap, status: SwapUpdateEvent, failureReason: string) => {
    this.logger.warn(`Swap ${swap.id} failed: ${failureReason}`);

    this.emit('swap.update', swap.id, { status, failureReason });
    this.emit('swap.failure', swap, false, failureReason);
  }

  private handleFailedReverseSwap = (
    reverseSwap: ReverseSwap,
    status: SwapUpdateEvent,
    failureReason: string,
  ) => {
    this.logger.warn(`Reverse swap ${reverseSwap.id} failed: ${failureReason}`);

    this.emit('swap.update', reverseSwap.id, { status, failureReason });
    this.emit('swap.failure', reverseSwap, true, failureReason);
  }
}

export default EventHandler;
export { SwapUpdate };
