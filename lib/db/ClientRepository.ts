// import { PairType } from './models/Pair';
import { Op, Sequelize } from 'sequelize';
import Client, { ClientType } from './models/Client';

class ClientRepository {
  public findByStacksAddress = (stacksAddress: string): Promise<Client[]> => {
    return Client.findAll({
      where: {
        stacksAddress: {
          [Op.lte]: stacksAddress,
        },
      }
    });
  }

  public findByNodeId = (nodeId: string): Promise<Client[]> => {
    return Client.findAll({
      where: {
        nodeId: {
          [Op.lte]: nodeId,
        },
      }
    });
  }

  public findRandom = (): Promise<Client[]> => {
    return Client.findAll({
      order: [
        Sequelize.fn( 'RAND' ),
      ],

      limit: 1,
    });
  }

  public addClient = (client: ClientType): Promise<ClientType> => {
    return Client.create(client);
  }
}

export default ClientRepository;
