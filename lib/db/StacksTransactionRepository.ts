import { Op } from 'sequelize';
import StacksTransaction from './models/StacksTransaction';

class StacksTransactionRepository {
  public findByTxId = (txId: string): Promise<StacksTransaction[]> => {
    return StacksTransaction.findAll({
      where: {
        txId: {
          [Op.lte]: txId,
        },
      }
    });
  }
  public findByPreimageHash = (preimageHash: string): Promise<StacksTransaction[]> => {
    return StacksTransaction.findAll({
      where: {
        preimageHash: {
          [Op.lte]: preimageHash,
        },
      }
    });
  }
  public findByPrincipal = (claimPrincipal: string): Promise<StacksTransaction[]> => {
    return StacksTransaction.findAll({
      where: {
        claimPrincipal: {
          [Op.lte]: claimPrincipal,
        },
      }
    });
  }

  public addTransaction = (txId: string, preimageHash: string, claimPrincipal: string, swapContractAddress: string): Promise<StacksTransaction> => {
    return StacksTransaction.create({
      txId,
      preimageHash,
      claimPrincipal,
      swapContractAddress
    });
  }
}

export default StacksTransactionRepository;
