import { Op } from 'sequelize';
import StacksTransaction from './models/StacksTransaction';
// import { crypto } from 'bitcoinjs-lib';
// import { getHexString } from '../../lib/Utils';

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
          [Op.eq]: preimageHash,
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

  public addTransaction = (txId: string, preimageHash: string, claimPrincipal: string, event: string, swapContractAddress: string): Promise<StacksTransaction> => {
    return StacksTransaction.create({
      txId,
      preimageHash,
      claimPrincipal,
      event,
      swapContractAddress
    });
  }

  public addClaimTransaction = (txId: string, preimageHash: string, event: string, swapContractAddress: string): Promise<StacksTransaction> => {
    // const preimageHash = getHexString(crypto.sha256(Buffer.from(preimage, 'hex')));
    return StacksTransaction.create({
      txId,
      preimageHash,
      event,
      swapContractAddress
    });
  }
}

export default StacksTransactionRepository;
