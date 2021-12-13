import { Op, WhereOptions } from 'sequelize';
import Swap, { SwapType } from './models/Swap';
import { SwapUpdateEvent } from '../consts/Enums';

class SwapRepository {
  public getSwaps = (options?: WhereOptions): Promise<Swap[]> => {
    return Swap.findAll({
      where: options,
    });
  }

  public getSwapsExpirable = (height: number): Promise<Swap[]> => {
    return Swap.findAll({
      where: {
        status: {
          [Op.not]: [
            SwapUpdateEvent.SwapExpired,
            SwapUpdateEvent.InvoiceFailedToPay,
            SwapUpdateEvent.TransactionClaimed,
          ],
        } as any,
        timeoutBlockHeight: {
          [Op.lte]: height,
        },
      },
    });
  }

  public getSwap = (options: WhereOptions): Promise<Swap | null> => {
    return Swap.findOne({
      where: options,
    });
  }

  public addSwap = (swap: SwapType): Promise<Swap> => {
    return Swap.create(swap);
  }

  public setSwapStatus = (swap: Swap, status: string, failureReason?: string,): Promise<Swap> => {
    return swap.update({
      status,
      failureReason,
    });
  }

  public setInvoice = (swap: Swap, invoice: string, expectedAmount: number, fee: number, acceptZeroConf: boolean): Promise<Swap> => {
    return swap.update({
      fee,
      invoice,
      acceptZeroConf,
      expectedAmount,
      status: SwapUpdateEvent.InvoiceSet,
    });
  }

  // invoice: string, expectedAmount: number, fee: number, 
  public setAcceptZeroConf = (swap: Swap, acceptZeroConf: boolean): Promise<Swap> => {
    return swap.update({
      acceptZeroConf,
      // expectedAmount,
      // status: SwapUpdateEvent.InvoiceSet,
    });
  }

  // TODO: probably bad idea changing this? - reverted
  public setLockupTransaction = (
    swap: Swap,
    lockupTransactionId: string,
    onchainAmount: number,
    confirmed: boolean,
    lockupTransactionVout?: number,
  ): Promise<Swap> => {
    console.log('setLockupTransaction ', swap.id, lockupTransactionId, confirmed);
    return swap.update({
      onchainAmount,
      lockupTransactionId,
      lockupTransactionVout,
      // status: confirmed ? SwapUpdateEvent.ASTransactionConfirmed : SwapUpdateEvent.ASTransactionMempool,
      status: confirmed ? SwapUpdateEvent.TransactionConfirmed : SwapUpdateEvent.TransactionMempool,
    });
  }

  public setASTransactionConfirmed = (
    swap: Swap,
    // onchainAmount: number,
    confirmed: boolean,
    // lockupTransactionVout?: number,
    lockupTransactionId?: string,
  ): Promise<Swap> => {
    console.log('setASTransactionConfirmed ', swap.id, confirmed);
    return swap.update({
      asLockupTransactionId: lockupTransactionId,
      status: confirmed ? SwapUpdateEvent.ASTransactionConfirmed : SwapUpdateEvent.ASTransactionMempool,
    });
  }

  public setRate = (swap: Swap, rate: number): Promise<Swap> => {
    return swap.update({
      rate,
    });
  }

  public setInvoicePaid = (swap: Swap, routingFee: number): Promise<Swap> => {
    return swap.update({
      routingFee,
      status: SwapUpdateEvent.InvoicePaid,
    });
  }

  public setMinerFee = (swap: Swap, minerFee: number): Promise<Swap> => {
    return swap.update({
      minerFee,
      status: SwapUpdateEvent.TransactionClaimed,
    });
  }

  public dropTable = (): Promise<void> => {
    return Swap.drop();
  }
}

export default SwapRepository;
