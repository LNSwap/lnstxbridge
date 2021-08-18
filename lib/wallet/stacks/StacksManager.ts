// import { ContractABIs } from 'boltz-core';
// import { ERC20 } from 'boltz-core/typechain/ERC20';
// import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
// import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
// import { constants, Contract, utils, Wallet as EthersWallet } from 'ethers';
// import GasNow from './GasNow';
import Errors from '../Errors';
import Wallet from '../Wallet';
import Logger from '../../Logger';
import { stringify } from '../../Utils';
import { StacksConfig } from '../../Config';
import ContractHandler from './ContractHandler';
import InjectedProvider from './InjectedProvider';
// import { CurrencyType } from '../../consts/Enums';
import ContractEventHandler from './ContractEventHandler';
import ChainTipRepository from '../../db/ChainTipRepository';
// import EtherWalletProvider from '../providers/EtherWalletProvider';
// import ERC20WalletProvider from '../providers/ERC20WalletProvider';
// import EthereumTransactionTracker from './EthereumTransactionTracker';
// import { StacksApiSocketClient } from '@stacks/blockchain-api-client';

import { deriveRootKeychainFromMnemonic, getAddress, deriveStxAddressChain } from '@stacks/keychain';
import { ChainID } from '@stacks/transactions';
import { getInfo } from './StacksUtils';

const chainId = ChainID.Testnet

type Network = {
  chainId: number;

  // Undefined for networks that are not recognised by Ethers
  name?: string;
};

class StacksManager {
  public provider: InjectedProvider;
  // public stacksClient: StacksApiSocketClient;

  public contractHandler: ContractHandler;
  public contractEventHandler: ContractEventHandler;

  // public etherSwap: EtherSwap;
  // public erc20Swap: ERC20Swap;

  public address!: string;
  public network!: Network;
  public btcAddress!: string;

  public tokenAddresses = new Map<string, string>();
  public stacksClient: any;

  // private static supportedContractVersions = {
  //   'EtherSwap': 2,
  //   'ERC20Swap': 2,
  // };

  constructor(
    private logger: Logger,
    private stacksConfig: StacksConfig,
  ) {
    if (this.stacksConfig.stxSwapAddress === '') {
      // || this.stacksConfig.erc20SwapAddress === ''
      throw Errors.MISSING_SWAP_CONTRACTS();
    }

    this.provider = new InjectedProvider(
      this.logger,
      this.stacksConfig,
    );

    // this.stacksClient = this.provider.getClient();
    // this.client = await connectWebSocketClient('wss://stacks-node-api.testnet.stacks.co/');

    this.logger.debug(`Using Stacks Swap contract: ${this.stacksConfig.stxSwapAddress}`);
    this.logger.debug(`Using Stacks ERC20 Swap contract: ${this.stacksConfig.erc20SwapAddress}`);

    // this.etherSwap = new Contract(
    //   stacksConfig.stxSwapAddress,
    //   ContractABIs.EtherSwap as any,
    // ) as any as EtherSwap;

    // this.erc20Swap = new Contract(
    //   stacksConfig.erc20SwapAddress,
    //   ContractABIs.ERC20Swap as any,
    // ) as any as ERC20Swap;

    // TODO: need to write these two from scratch!
    this.contractHandler = new ContractHandler(this.logger);
    this.contractEventHandler = new ContractEventHandler(this.logger);
    this.stacksClient = true;
  }

  public init = async (mnemonic: string, chainTipRepository: ChainTipRepository): Promise<Map<string, Wallet>> => {
    this.logger.info('StacksManager.90 INIT injectedprovider');
    await this.provider.init();
    
    // const network = await this.provider.getNetwork();
    // this.network = {
    //   name: network.name !== 'unknown' ? network.name : undefined,
    //   chainId: network.chainId,
    // };

    // this.stacksClient = this.provider.getClient();
    this.stacksClient = true

    // this.logger.error('stacksmanager init network, '+ network);
  
    const signer = await deriveRootKeychainFromMnemonic(mnemonic);
    this.logger.error("stacksmanager.105 got signer: " + JSON.stringify(signer));
    // const signer = EthersWallet.fromMnemonic(mnemonic).connect(this.provider);
    // this.address = await signer.getAddress();

    // looks like this is bitcoin address
    this.btcAddress = await getAddress(signer)

    
    const derivedData = await deriveStxAddressChain(chainId)(signer)
    this.logger.error("stacksmanager.117 derivedData "+ JSON.stringify(derivedData));
    this.address = derivedData.address;

    // this.etherSwap = this.etherSwap.connect(signer);
    // this.erc20Swap = this.erc20Swap.connect(signer);

    // await Promise.all([
    //   this.checkContractVersion('EtherSwap', this.etherSwap, RskManager.supportedContractVersions.EtherSwap),
    //   this.checkContractVersion('ERC20Swap', this.erc20Swap, RskManager.supportedContractVersions.ERC20Swap),
    // ]);

    this.logger.verbose(`Using Stacks signer: ${this.address}`);

    const info = await getInfo();
    this.logger.error("stacksmanager.133 info "+ JSON.stringify(info));

    // const currentBlock = await signer.provider!.getBlockNumber();
    const currentBlock = info.stacks_tip_height;
    this.logger.error("StacksManager currentBlock: "+ currentBlock);
    const chainTip = await chainTipRepository.findOrCreateTip('STX', currentBlock);

    // , this.erc20Swap
    this.contractHandler.init(this.stacksConfig.stxSwapAddress);
    // this.etherSwap, this.erc20Swap
    this.contractEventHandler.init(this.stacksConfig.stxSwapAddress);

    this.logger.verbose(`Stacks chain status: ${stringify({
      chainId: chainId,
      blockNumber: currentBlock,
    })}`);

    // await new GasNow(
    //   this.logger,
    //   await this.provider.getNetwork(),
    // ).init();
    // const transactionTracker = await new EthereumTransactionTracker(
    //   this.logger,
    //   this.provider,
    //   signer,
    // );

    // await transactionTracker.init();

    // I don't see any way to subscribe to Stacks blocks
    // Using setinterval instead every minute :)
    setInterval(function(){
      checkblockheight(chainTipRepository, chainTip)
    }, 60000);

    // and maybe separately subscribe to our contract address to get updates instead of scanning the block for our TX
    // TODO
    // this.logger.error("stacksmanager.167 TODO subscribe to contract updates and check for any relevant thing.")
    // listenContract(this.stacksConfig.stxSwapAddress);

    this.logger.error("TODO need to scan the blocks(?) and remove swaps from db if they're found...")

    // this.provider.on('block', async (blockNumber: number) => {
    //   this.logger.silly(`Got new Stacks block: ${ blockNumber }`);

    //   await Promise.all([
    //     chainTipRepository.updateTip(chainTip, blockNumber),
    //     // transactionTracker.scanBlock(blockNumber),
    //   ]);
    // });

    const wallets = new Map<string, Wallet>();

    // for (const token of this.stacksConfig.tokens) {
    //   if (token.contractAddress) {
    //     if (token.decimals) {
    //       if (!wallets.has(token.symbol)) {
    //         // Wrap the address in "utils.getAddress" to make sure it is a checksum one
    //         this.tokenAddresses.set(token.symbol, utils.getAddress(token.contractAddress));
    //         const provider = new ERC20WalletProvider(this.logger, signer, {
    //           symbol: token.symbol,
    //           decimals: token.decimals,
    //           contract: new Contract(token.contractAddress, ContractABIs.ERC20, signer) as any as ERC20,
    //         });

    //         wallets.set(token.symbol, new Wallet(
    //           this.logger,
    //           CurrencyType.ERC20,
    //           provider,
    //         ));

    //         await this.checkERC20Allowance(provider);
    //       } else {
    //         throw Errors.INVALID_ETHEREUM_CONFIGURATION(`duplicate ${token.symbol} token config`);
    //       }
    //     } else {
    //       throw Errors.INVALID_ETHEREUM_CONFIGURATION(`missing decimals configuration for token: ${token.symbol}`);
    //     }
    //   } else {
    //     if (token.symbol === 'RBTC') {
    //       if (!wallets.has('RBTC')) {
    //         wallets.set('RBTC', new Wallet(
    //           this.logger,
    //           CurrencyType.Rbtc,
    //           new EtherWalletProvider(this.logger, signer),
    //         ));
    //       } else {
    //         throw Errors.INVALID_ETHEREUM_CONFIGURATION('duplicate Stacks token config');
    //       }
    //     } else {
    //       throw Errors.INVALID_ETHEREUM_CONFIGURATION(`missing token contract address for: ${stringify(token)}`);
    //     }
    //   }
    // }

    return wallets;
  }

  // private checkERC20Allowance = async (erc20Wallet: ERC20WalletProvider) => {
  //   const allowance = await erc20Wallet.getAllowance(this.stacksConfig.erc20SwapAddress);

  //   this.logger.debug(`Allowance of ${erc20Wallet.symbol} is ${allowance.toString()}`);

  //   if (allowance.isZero()) {
  //     this.logger.verbose(`Setting allowance of ${erc20Wallet.symbol}`);

  //     const { transactionId } = await erc20Wallet.approve(
  //       this.stacksConfig.erc20SwapAddress,
  //       constants.MaxUint256,
  //     );

  //     this.logger.info(`Set allowance of token ${erc20Wallet.symbol }: ${transactionId}`);
  //   }
  // }

  // private checkContractVersion = async (name: string, contract: EtherSwap | ERC20Swap, supportedVersion: number) => {
  //   const contractVersion = await contract.version();

  //   if (contractVersion !== supportedVersion) {
  //     throw Errors.UNSUPPORTED_CONTRACT_VERSION(name, contract.address, contractVersion, supportedVersion);
  //   }
  // }
}

async function checkblockheight (chainTipRepository, chainTip) {
  const info = await getInfo();
  console.log("regular check for stx block height: " + info.stacks_tip_height)
  chainTipRepository.updateTip(chainTip, info.stacks_tip_height)
}

export default StacksManager;
export { Network };
