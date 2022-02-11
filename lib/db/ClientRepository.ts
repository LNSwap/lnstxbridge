// import { PairType } from './models/Pair';
import { Op } from 'sequelize';
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

  public addClient = (client: ClientType): Promise<ClientType> => {
    return Client.create(client);
  }
}

export default ClientRepository;
