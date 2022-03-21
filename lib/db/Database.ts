import Sequelize from 'sequelize';
import Logger from '../Logger';
import Pair from './models/Pair';
import DirectSwap from './models/DirectSwap';
import Swap from './models/Swap';
import Migration from './Migration';
import ChainTip from './models/ChainTip';
import ReverseSwap from './models/ReverseSwap';
import KeyProvider from './models/KeyProvider';
import { Currency } from '../wallet/WalletManager';
import DatabaseVersion from './models/DatabaseVersion';
import ChannelCreation from './models/ChannelCreation';
import PendingEthereumTransaction from './models/PendingEthereumTransaction';
import Client from './models/Client';
import ProviderSwap from './models/ProviderSwap';
import StacksTransaction from './models/StacksTransaction';

class Db {
  public sequelize: Sequelize.Sequelize;

  private migration: Migration;

  /**
   * @param logger logger that should be used
   * @param storage the file path to the SQLite database; if ':memory:' the database will be stored in the memory
   */
  constructor(private logger: Logger, private storage: string) {
    this.sequelize = new Sequelize.Sequelize({
      storage,
      dialect: 'sqlite',
      logging: this.logger.silly,
    });

    this.loadModels();

    this.migration = new Migration(this.logger, this.sequelize);
  }

  public init = async (): Promise<void> => {
    try {
      await this.sequelize.authenticate();
      this.logger.info(`Connected to database: ${this.storage === ':memory:' ? 'in memory' : this.storage}`);
    } catch (error) {
      this.logger.error(`Could not connect to database: ${error}`);
      throw error;
    }

    await Promise.all([
      Pair.sync(),
      DirectSwap.sync(),
      ChainTip.sync(),
      KeyProvider.sync(),
      DatabaseVersion.sync(),
      PendingEthereumTransaction.sync(),
      Client.sync(),
      ProviderSwap.sync(),
      StacksTransaction.sync(),
    ]);

    await Promise.all([
      Swap.sync(),
      ReverseSwap.sync(),
    ]);

    await ChannelCreation.sync();
  }

  public migrate = async (currencies: Map<string, Currency>): Promise<void> => {
    await this.migration.migrate(currencies);
  }

  public close = (): Promise<void> => {
    return this.sequelize.close();
  }

  private loadModels = () => {
    Pair.load(this.sequelize);
    DirectSwap.load(this.sequelize);
    Swap.load(this.sequelize);
    ChainTip.load(this.sequelize);
    ReverseSwap.load(this.sequelize);
    KeyProvider.load(this.sequelize);
    ChannelCreation.load(this.sequelize);
    DatabaseVersion.load(this.sequelize);
    PendingEthereumTransaction.load(this.sequelize);
    Client.load(this.sequelize);
    ProviderSwap.load(this.sequelize);
    StacksTransaction.load(this.sequelize);
  }
}

export default Db;
