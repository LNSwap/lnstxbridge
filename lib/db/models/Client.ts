import { Model, Sequelize, DataTypes } from 'sequelize';
// import { PairType } from './Pair';
// import { PairType } from '../../rates/RateProvider';

type ClientType = {
  id: string;
  stacksAddress: string;
  nodeId: string;
  url: string;
  // pairs: Map<string, PairType>;
  pairs: string;
  success: number;
  fail: number;
};

class Client extends Model implements ClientType {
  public id!: string;
  public stacksAddress!: string;
  public nodeId!: string;
  public url!: string;
  // public pairs!: Map<string, PairType>;
  public pairs!: string;
  public success!: number;
  public fail!: number;

  public static load = (sequelize: Sequelize): void => {
    Client.init({
      id: { type: new DataTypes.STRING(255), primaryKey: true },
      stacksAddress: { type: new DataTypes.STRING(255), allowNull: false },
      nodeId: { type: new DataTypes.STRING(255), allowNull: false },
      url: { type: new DataTypes.STRING(255), allowNull: false },
      pairs: { type: new DataTypes.STRING(1255), allowNull: false },
      success: { type: new DataTypes.INTEGER(), allowNull: true },
      fail: { type: new DataTypes.INTEGER(), allowNull: true },
    }, {
      sequelize,
      tableName: 'clients',
      timestamps: true,
    });
  }
}

export default Client;
export { ClientType };