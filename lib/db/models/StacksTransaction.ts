import { DataTypes, Model, Sequelize } from 'sequelize';

type StacksTransactionType = {
  txId: string;
  preimageHash: string;
  claimPrincipal: string;
  swapContractAddress: string;
};

class StacksTransaction extends Model implements StacksTransactionType {
  public txId!: string;
  public preimageHash!: string;
  public claimPrincipal!: string;
  public swapContractAddress!: string;

  public static load = (sequelize: Sequelize): void => {
    StacksTransaction.init({
      txId: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      preimageHash: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      claimPrincipal: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      swapContractAddress: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      // nonce: { type: new DataTypes.INTEGER(), unique: true, allowNull: false },
    }, {
      sequelize,
      timestamps: false,
      tableName: 'stacksTransactions',
      indexes: [
        {
          unique: true,
          fields: ['preimageHash'],
        },
        {
          unique: true,
          fields: ['claimPrincipal'],
        },
      ],
    });
  }
}

export default StacksTransaction;
export { StacksTransactionType };
