import { BigNumber } from 'ethers';
import Logger from '../../Logger';
import { Sip10Token } from '../../consts/Types';
// import { getGasPrice } from '../ethereum/EthereumUtils';
import WalletProviderInterface, { SentTransaction, WalletBalance } from './WalletProviderInterface';
import { BIP32Interface } from 'bip32';

import {
  callReadOnlyFunction,
  cvToJSON,
  standardPrincipalCV,
  // cvToJSON,
} from '@stacks/transactions';
import { getStacksNetwork } from '../stacks/StacksUtils';

class SIP10WalletProvider implements WalletProviderInterface {
  public readonly symbol: string;

  constructor(private logger: Logger, private signer: BIP32Interface, private signerAddress: string, private token: Sip10Token) {
    this.symbol = token.symbol;
    // this.logger.silly('sip10walletprovider signer ' + this.signer.publicKey);

    this.logger.info(`Initialized ${this.symbol} SIP10 wallet with contract: ${token.contract} and ${this.signer.publicKey}`);
    // .address
  }

  public getTokenAddress = (): string => {
    return this.token.contract;
    // .address
  }

  public getAddress = (): Promise<string> => {
    // return this.signer.getAddress();
    // return <Promise>"this.signer.";
    return new Promise<string>((resolve) => {resolve('getAddress');});
  }

  public getBalance = async (): Promise<WalletBalance> => {
    this.logger.info('sip10walletprovider.25 getbalance');

    const contractAddress = this.getTokenAddress().split('.')[0];
    const contractName = this.getTokenAddress().split('.')[1];
    const functionName = 'get-balance';
    const buffer = standardPrincipalCV(this.signerAddress);
    const network = getStacksNetwork().stacksNetwork;
    const senderAddress = this.getTokenAddress().split('.')[0];

    const options = {
      contractAddress,
      contractName,
      functionName,
      functionArgs: [buffer],
      network,
      senderAddress,
    };

    const sip10balance = await callReadOnlyFunction(options);
    this.logger.silly('sip10balance '+ cvToJSON(sip10balance));
    const balance = this.normalizeTokenAmount(
      cvToJSON(sip10balance).value.value
      // await this.token.contract.balanceOf(await this.getAddress()),
    );
    this.logger.silly('sip10balance normalized '+ balance);
    return {
      totalBalance: balance,
      confirmedBalance: balance,
      unconfirmedBalance: 0,
    };
  }

  public sendToAddress = async (address: string, amount: number, gasPrice?: number): Promise<SentTransaction> => {
    // const actualAmount = this.formatTokenAmount(amount);
    // const transaction = await this.token.contract.transfer(address, actualAmount, {
    //   gasPrice: await getGasPrice(this.signer.provider!, gasPrice),
    // });
    this.logger.error(`sip10walletprovider sendToAddress not implemented ${address} ${amount} ${gasPrice}`);
    return {
      transactionId: 'transaction.hash',
    };
  }

  public sweepWallet = async (address: string, gasPrice?: number): Promise<SentTransaction> => {
    // const balance = await this.token.contract.balanceOf(await this.getAddress());
    // const transaction = await this.token.contract.transfer(address, balance, {
    //   gasPrice: await getGasPrice(this.signer.provider!, gasPrice),
    // });

    this.logger.error(`sip10walletprovider sweepWallet not implemented ${address} ${gasPrice}`);
    return {
      transactionId: 'transaction.hash',
    };
  }

  public getAllowance = async (spender: string): Promise<BigNumber> => {
    this.logger.error(`sip10walletprovider getAllowance not implemented ${spender}`);
    // this.logger.verbose("sip10 getAllowance " + spender);
    // return this.token.contract.allowance(await this.signer.getAddress(), spender);
    return BigNumber.from(1000000);
  }

  public approve = async (spender: string, amount: BigNumber): Promise<SentTransaction> => {
    // const transaction = await this.token.contract.approve(spender, amount);
    this.logger.error(`sip10walletprovider approve not implemented ${spender} ${amount}`);

    return {
      transactionId: 'transaction.hash',
    };
  }

  /**
   * Formats the token amount to send from 10 ** -8 decimals
   */
  public formatTokenAmount = (amount: number): BigNumber => {
    const amountBn = BigNumber.from(amount);

    if (this.token.decimals === 8) {
      return amountBn;
    } else {
      const exponent = BigNumber.from(10).pow(BigNumber.from(Math.abs(this.token.decimals - 8)));

      if (this.token.decimals > 8) {
        return amountBn.mul(exponent);
      } else {
        return amountBn.div(exponent);
      }
    }
  }

  /**
   * Normalizes the token balance to 10 ** -8 decimals
   */
  public normalizeTokenAmount = (amount: BigNumber): number => {
    if (this.token.decimals === 8) {
      return amount.toNumber();
    } else {
      const exponent = BigNumber.from(10).pow(BigNumber.from(Math.abs(this.token.decimals - 8)));

      if (this.token.decimals > 8) {
        return amount.div(exponent).toNumber();
      } else {
        return amount.mul(exponent).toNumber();
      }
    }
  }
}

export default SIP10WalletProvider;
