import { Op, WhereOptions } from 'sequelize';
import ProviderSwap, { ProviderSwapType } from './models/ProviderSwap';

class ProviderSwapRepository {
  public getProviderSwaps = (): Promise<ProviderSwap[]> => {
    return ProviderSwap.findAll({});
  }

  public getSwap = (options: WhereOptions): Promise<ProviderSwap | null> => {
    return ProviderSwap.findOne({
      where: options,
    });
  }

  public addProviderSwap = (providerSwap: ProviderSwapType): Promise<ProviderSwap> => {
    return ProviderSwap.create(providerSwap);
  }

  public setSwapStatus = (providerSwap: ProviderSwap, status: string, failureReason?: string, txId?: string): Promise<ProviderSwap> => {
    return providerSwap.update({
      status,
      failureReason,
      txId,
    });
  }

  public removeProviderSwap = (id: string): Promise<number> => {
    return ProviderSwap.destroy({
      where: {
        id: {
          [Op.eq]: id,
        },
      },
    });
  }

  public dropTable = async (): Promise<void> => {
    return ProviderSwap.drop();
  }
}

export default ProviderSwapRepository;
