// import { BigNumber } from 'ethers';
import Logger from '../../Logger';
// import { etherDecimals } from '../../consts/Consts';
// import { getGasPrice } from '../ethereum/EthereumUtils';
import WalletProviderInterface, { SentTransaction, WalletBalance } from './WalletProviderInterface';
import { BIP32Interface } from 'bip32';
import { deriveStxAddressChain } from '@stacks/keychain';
import { ChainID, AnchorMode, makeSTXTokenTransfer, broadcastTransaction } from '@stacks/transactions';
import { getAddressBalance, getStacksNetwork } from '../stacks/StacksUtils'
// import { StacksTestnet, StacksMainnet } from '@stacks/network';

// let networkconf:string = "testnet";
// let network = new StacksTestnet();
// if(networkconf=="mainnet"){
//   network = new StacksMainnet();
// }

class StacksWalletProvider implements WalletProviderInterface {
  public readonly symbol: string;

  // The gas needed for sending STX is 1
  // private readonly ethTransferGas = BigNumber.from(1);

  // private signer: Signer
  constructor(private logger: Logger, private signer: BIP32Interface, private chainId: ChainID) {
    this.symbol = 'STX';
    this.logger.info('Initialized STX wallet');
  }

  public getAddress = async (): Promise<string> => {
    // return this.signer.getAddress();
    // return await getAddress(this.signer)
    return await deriveStxAddressChain(this.chainId)(this.signer).address
  }

  public getBalance = async (): Promise<WalletBalance> => {
    const myaddress = await this.getAddress();
    // this.logger.debug(`stackswalletprovider.38 ${this.stacksNetwork}`);
    const balance = await getAddressBalance(myaddress);
    // const balance = (await this.signer.getBalance()).div(etherDecimals).toNumber();

    return {
      totalBalance: balance,
      confirmedBalance: balance,
      unconfirmedBalance: 0,
    };
  }

  // , gasPrice?: number
  public sendToAddress = async (address: string, amount: number): Promise<SentTransaction> => {
    const txOptions = {
      recipient: address,
      amount: amount,
      senderKey: getStacksNetwork().privateKey,
      network: getStacksNetwork().stacksNetwork,
      // memo: 'test memo',
      // nonce: new BigNum(0), // set a nonce manually if you don't want builder to fetch from a Stacks node
      // fee: new BigNum(200), // set a tx fee if you don't want the builder to estimate
      anchorMode: AnchorMode.Any,
    };
    
    const transaction = await makeSTXTokenTransfer(txOptions);
    
    // to see the raw serialized tx
    const serializedTx = transaction.serialize().toString('hex');
    this.logger.debug("stackswalletprovider.64 sendToAddress serializedTx: " + serializedTx)
    
    // broadcasting transaction to the specified network
    const broadcastResponse = await broadcastTransaction(transaction, getStacksNetwork().stacksNetwork);
    const txId = broadcastResponse.txid;

    return {
      transactionId: txId,
    };
  }

  // address: string, gasPrice?: number
  public sweepWallet = async (): Promise<SentTransaction> => {
    
    this.logger.error("stackswalletprovider.77 TODO: sweepWallet not implemented!")

    return {
      transactionId: "transaction.hash",
    };

    // const balance = await this.signer.getBalance();

    // const actualGasPrice = await getGasPrice(this.signer.provider!, gasPrice);
    // const gasCost = this.ethTransferGas.mul(actualGasPrice);

    // const value = balance.sub(gasCost);

    // const transaction = await this.signer.sendTransaction({
    //   value,
    //   to: address,
    //   gasPrice: actualGasPrice,
    //   gasLimit: this.ethTransferGas,
    // });

    // return {
    //   transactionId: transaction.hash,
    // };
  }
}

export default StacksWalletProvider;
