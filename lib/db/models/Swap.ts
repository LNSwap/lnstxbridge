import { Model, Sequelize, DataTypes } from 'sequelize';
import Pair from './Pair';

type SwapType = {
  id: string;

  keyIndex?: number;
  redeemScript?: string;

  fee?: number;
  routingFee?: number;
  minerFee?: number;

  pair: string;
  orderSide: number;

  status: string;
  failureReason?: string;

  preimageHash: string;
  invoice?: string;

  acceptZeroConf?: boolean;
  timeoutBlockHeight: number;
  rate?: number;
  expectedAmount?: number;
  onchainAmount?: number;
  lockupAddress: string;
  lockupTransactionId?: string;
  lockupTransactionVout?: number;

  claimAddress?: string;
  tokenAddress?: string;
  contractAddress?: string;
  asLockupTransactionId?: string;
  // asLockedAmount?: number;
  asRequestedAmount?: number;
  asTimeoutBlockHeight?: number;
  baseAmount?: number;
  quoteAmount?: number;
  asRedeemScript?: string,
  asLockupAddress?: string,
};

class Swap extends Model implements SwapType {
  public id!: string;

  public keyIndex?: number;
  public redeemScript?: string;

  public fee?: number;
  public routingFee?: number;
  public minerFee?: number;

  public pair!: string;
  public orderSide!: number;

  public status!: string;
  public failureReason?: string;

  public preimageHash!: string;
  public invoice?: string;

  public acceptZeroConf?: boolean;
  public timeoutBlockHeight!: number;
  public rate?: number;
  public expectedAmount?: number;
  public onchainAmount?: number;
  public lockupAddress!: string;
  public lockupTransactionId?: string;
  public lockupTransactionVout?: number;

  public createdAt!: Date;
  public updatedAt!: Date;

  public claimAddress?: string;
  public tokenAddress?: string;
  public contractAddress?: string;

  public asLockupTransactionId?: string;
  // public asLockedAmount?: number;
  public asRequestedAmount?: number;
  public asTimeoutBlockHeight?: number;

  public baseAmount?: number;
  public quoteAmount?: number;
  public asRedeemScript?: string;
  public asLockupAddress?: string;

  public static load = (sequelize: Sequelize): void => {
    Swap.init({
      id: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      keyIndex: { type: new DataTypes.INTEGER(), allowNull: true },
      redeemScript: { type: new DataTypes.STRING(255), allowNull: true },
      fee: { type: new DataTypes.INTEGER(), allowNull: true },
      routingFee: { type: new DataTypes.INTEGER(), allowNull: true },
      minerFee: { type: new DataTypes.INTEGER(), allowNull: true },
      pair: { type: new DataTypes.STRING(255), allowNull: false },
      orderSide: { type: new DataTypes.INTEGER(), allowNull: false },
      status: { type: new DataTypes.STRING(255), allowNull: false },
      failureReason: { type: new DataTypes.STRING(255), allowNull: true },
      preimageHash: { type: new DataTypes.STRING(255), allowNull: false, unique: true },
      invoice: { type: new DataTypes.STRING(255), allowNull: true, unique: true },
      acceptZeroConf: { type: DataTypes.BOOLEAN, allowNull: true },
      timeoutBlockHeight: { type: new DataTypes.INTEGER(), allowNull: false },
      rate: { type: new DataTypes.REAL(), allowNull: true },
      expectedAmount: { type: new DataTypes.INTEGER(), allowNull: true },
      onchainAmount: { type: new DataTypes.INTEGER(), allowNull: true },
      lockupAddress: { type: new DataTypes.STRING(255), allowNull: false },
      lockupTransactionId: { type: new DataTypes.STRING(255), allowNull: true },
      lockupTransactionVout: { type: new DataTypes.INTEGER(), allowNull: true },
      claimAddress: { type: new DataTypes.STRING(255), allowNull: true },
      contractAddress: { type: new DataTypes.STRING(255), allowNull: true },
      asLockupTransactionId: { type: new DataTypes.STRING(255), allowNull: true },
      asLockedAmount: { type: new DataTypes.INTEGER(), allowNull: true },
      asRequestedAmount: { type: new DataTypes.INTEGER(), allowNull: true },
      asTimeoutBlockHeight: { type: new DataTypes.INTEGER(), allowNull: true },
      baseAmount: { type: new DataTypes.INTEGER(), allowNull: true },
      quoteAmount: { type: new DataTypes.INTEGER(), allowNull: true },
      asRedeemScript: { type: new DataTypes.STRING(255), allowNull: true },
      asLockupAddress: { type: new DataTypes.STRING(255), allowNull: true },
      tokenAddress: { type: new DataTypes.STRING(255), allowNull: true },
    }, {
      sequelize,
      tableName: 'swaps',
      indexes: [
        {
          unique: true,
          fields: ['id'],
        },
        {
          unique: true,
          fields: ['preimageHash'],
        },
        {
          unique: true,
          fields: ['invoice'],
        },
      ],
    });

    Swap.belongsTo(Pair, {
      foreignKey: 'pair',
    });
  }
}

export default Swap;
export { SwapType };
