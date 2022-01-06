import { Op, WhereOptions } from 'sequelize';
import DirectSwap, { DirectSwapType } from './models/DirectSwap';

class DirectSwapRepository {
  public getDirectSwaps = (): Promise<DirectSwap[]> => {
    return DirectSwap.findAll({});
  }

  public getSwap = (options: WhereOptions): Promise<DirectSwap | null> => {
    return DirectSwap.findOne({
      where: options,
    });
  }

  public addDirectSwap = (directSwap: DirectSwapType): Promise<DirectSwap> => {
    return DirectSwap.create(directSwap);
  }

  public setSwapStatus = (directSwap: DirectSwap, status: string, failureReason?: string, txId?: string): Promise<DirectSwap> => {
    return directSwap.update({
      status,
      failureReason,
      txId,
    });
  }

  public removeDirectSwap = (id: string): Promise<number> => {
    return DirectSwap.destroy({
      where: {
        id: {
          [Op.eq]: id,
        },
      },
    });
  }

  public dropTable = async (): Promise<void> => {
    return DirectSwap.drop();
  }
}

export default DirectSwapRepository;
