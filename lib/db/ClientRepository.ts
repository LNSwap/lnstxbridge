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

  public findByUrl = (url: string): Promise<Client[]> => {
    return Client.findAll({
      where: {
        url: {
          [Op.lte]: url,
        },
      }
    });
  }

  public findRandom = (): Promise<Client[]> => {
    return Client.findAll({
      order: [
        // Sequelize.fn( 'RANDOM' ),
        Sequelize.literal('RANDOM()')
      ],

      limit: 1,
    });
  }

  public getAll = (): Promise<Client[]> => {
    return Client.findAll();
  }

  public addClient = (client: ClientType): Promise<ClientType> => {
    return Client.create(client);
  }

  public removeClient = (id: string): Promise<number> => {
    return Client.destroy({
      where: {
        id: {
          [Op.eq]: id,
        },
      },
    });
  }

  public updateClient = (client: Client, stacksAddress: string, nodeId: string, url: string, pairs: string, localLNBalance?: number, remoteLNBalance?: number, onchainBalance?: number, StxBalance?: number ): Promise<Client> => {
    return client.update({
      stacksAddress,
      nodeId,
      url,
      pairs,
      localLNBalance,
      remoteLNBalance,
      onchainBalance,
      StxBalance,
      // updatedAt: new Date(),
    });
  }

  public incrementSuccess = (client: Client, success: number): Promise<Client> => {
    return client.increment('success', { by: success });
  }

  public incrementFailure = (client: Client, fail: number): Promise<Client> => {
    return client.increment('fail', { by: fail });
  }

}

export default ClientRepository;
