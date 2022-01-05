import { Model, Sequelize, DataTypes } from 'sequelize';

type DirectSwapType = {
  id: string;
  nftAddress: string;
  userAddress: string;
  contractSignature?: string;
  invoice?: string;
  status: string;
  txId?: string;
};

class DirectSwap extends Model implements DirectSwapType {
  public id!: string;
  public nftAddress!: string;
  public userAddress!: string;
  public contractSignature?: string;
  public invoice?: string;
  public status!: string;
  public txId?: string;

  public createdAt!: Date;
  public updatedAt!: Date;

  public static load = (sequelize: Sequelize): void => {
    DirectSwap.init({
      id: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      nftAddress: { type: new DataTypes.STRING(255), allowNull: false },
      userAddress: { type: new DataTypes.STRING(255), allowNull: false },
      contractSignature: { type: new DataTypes.STRING(255), allowNull: true },
      invoice: { type: new DataTypes.STRING(255), allowNull: true, unique: true },
      status: { type: new DataTypes.STRING(255), allowNull: true },
      txId: { type: new DataTypes.STRING(255), allowNull: true },
    }, {
      sequelize,
      tableName: 'directSwaps',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['id'],
        },
      ]
    });
  }
}

export default DirectSwap;
export { DirectSwapType };
