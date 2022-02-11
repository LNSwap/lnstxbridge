import { Model, Sequelize, DataTypes } from 'sequelize';

type ProviderSwapType = {
  id: string;
  providerUrl: string;
  status?: string;
  txId?: string;
  failureReason?: string;
};

class ProviderSwap extends Model implements ProviderSwapType {
  public id!: string;
  public providerUrl!: string;
  public status?: string;
  public txId?: string;
  public failureReason?: string;

  public createdAt!: Date;
  public updatedAt!: Date;

  public static load = (sequelize: Sequelize): void => {
    ProviderSwap.init({
      id: { type: new DataTypes.STRING(255), primaryKey: true, allowNull: false },
      status: { type: new DataTypes.STRING(255), },
      providerUrl: { type: new DataTypes.STRING(255), },
      txId: { type: new DataTypes.STRING(255), },
      failureReason: { type: new DataTypes.STRING(255), },
    }, {
      sequelize,
      tableName: 'providerSwaps',
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

export default ProviderSwap;
export { ProviderSwapType };
