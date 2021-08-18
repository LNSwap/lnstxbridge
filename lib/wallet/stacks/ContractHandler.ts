import { BigNumber, ContractTransaction } from 'ethers';
import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import Logger from '../../Logger';
import { getHexString, stringify } from '../../Utils';
import { getGasPrice } from './StacksUtils';
import ERC20WalletProvider from '../providers/ERC20WalletProvider';
import { ethereumPrepayMinerFeeGasLimit } from '../../consts/Consts';

// makeContractCall, , broadcastTransaction, 
import { bufferCV, AnchorMode, FungibleConditionCode, makeStandardSTXPostCondition } from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
const BigNum = require('bn.js');

let networkconf:string = "testnet";
let network = new StacksTestnet();
if(networkconf=="mainnet"){
  network = new StacksMainnet();
}

class ContractHandler {
  private etherSwap!: EtherSwap;
  private erc20Swap!: ERC20Swap;
  private contractAddress!: string;
  private contractName!: string;

  constructor(
    private logger: Logger,
  ) {}

  // etherSwap: EtherSwap, erc20Swap: ERC20Swap
  public init = (contract:string): void => {
    this.contractAddress = contract.split(".")[0]
    this.contractName = contract.split(".")[1]
    // this.etherSwap = etherSwap;
    // this.erc20Swap = erc20Swap;
  }

  public lockupEther = async (
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Locking ${amount} Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
      value: amount,
      gasPrice: await getGasPrice(this.etherSwap.provider),
    });
  }

  public lockupStx = async (
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Locking ${amount} Stx with preimage hash: ${getHexString(preimageHash)}`);

    // Add an optional post condition
    // See below for details on constructing post conditions
    const postConditionAddress = this.contractAddress;
    const postConditionCode = FungibleConditionCode.GreaterEqual;
    // new BigNum(1000000);
    const postConditionAmount = new BigNum(amount);
    const postConditions = [
      makeStandardSTXPostCondition(postConditionAddress, postConditionCode, postConditionAmount),
    ];

    // (lockStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16))
    const functionArgs = [
      bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
      bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    ];
    this.logger.error("stacks contracthandler.80 functionargs: "+stringify(functionArgs));

    // const functionArgs = [
    //   bufferCV(preimageHash),
    //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    // ];

    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'lockStx',
      functionArgs: functionArgs,
      senderKey: 'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01',
      validateWithAbi: true,
      network,
      postConditions,
      anchorMode: AnchorMode.Any,
    };

    this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

    // const transaction = await makeContractCall(txOptions);
    // broadcastTransaction(transaction, network);

    return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
      value: amount,
      gasPrice: await getGasPrice(this.etherSwap.provider),
    });
  }

  public lockupEtherPrepayMinerfee = async (
    preimageHash: Buffer,
    amount: BigNumber,
    amountPrepay: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    const transactionValue = amount.add(amountPrepay);

    const gasLimitEstimationWithoutPrepay = await this.etherSwap.estimateGas.lock(
      preimageHash,
      claimAddress,
      timeLock,
      {
        value: transactionValue,
      },
    );

    this.logger.debug(`Locking ${amount} and sending prepay ${amountPrepay} Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.etherSwap.lockPrepayMinerfee(
      preimageHash,
      claimAddress,
      timeLock,
      amountPrepay,
      {
        value: transactionValue,
        gasPrice: await getGasPrice(this.etherSwap.provider),
        // TODO: integration test that tries to exploit the attack vector of using an insane amount of gas in the fallback function of the contract at the claim address
        gasLimit: gasLimitEstimationWithoutPrepay.add(ethereumPrepayMinerFeeGasLimit),
      },
    );
  }

  public claimEther = async (
    preimage: Buffer,
    amount: BigNumber,
    refundAddress: string,
    timelock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Claiming Rbtc with preimage: ${getHexString(preimage)}`);
    this.logger.error("claim data: " + refundAddress);
    return this.etherSwap.claim(
      preimage,
      amount,
      refundAddress,
      timelock,
      {
        gasPrice: await getGasPrice(this.etherSwap.provider),
      }
    );
  }

  public refundEther = async (
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timelock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Refunding Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.etherSwap.refund(
      preimageHash,
      amount,
      claimAddress,
      timelock,
      {
        gasPrice: await getGasPrice(this.etherSwap.provider),
      }
    );
  }

  public lockupToken = async (
    token: ERC20WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Locking ${amount} ${token.symbol} with preimage hash: ${getHexString(preimageHash)}`);
    return this.erc20Swap.lock(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
      {
        gasPrice: await getGasPrice(this.erc20Swap.provider),
      }
    );
  }

  public lockupTokenPrepayMinerfee = async (
    token: ERC20WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    amountPrepay: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    const gasLimitEstimationWithoutPrepay = await this.erc20Swap.estimateGas.lock(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
    );

    this.logger.debug(`Locking ${amount} ${token.symbol} and sending prepay ${amountPrepay} Rbtc with preimage hash: ${getHexString(preimageHash)}`);
    return this.erc20Swap.lockPrepayMinerfee(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
      {
        value: amountPrepay,
        gasPrice: await getGasPrice(this.etherSwap.provider),
        gasLimit: gasLimitEstimationWithoutPrepay.add(ethereumPrepayMinerFeeGasLimit),
      },
    );
  }

  public claimToken = async (
    token: ERC20WalletProvider,
    preimage: Buffer,
    amount: BigNumber,
    refundAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Claiming ${token.symbol} with preimage: ${getHexString(preimage)}`);
    return this.erc20Swap.claim(
      preimage,
      amount,
      token.getTokenAddress(),
      refundAddress,
      timeLock,
      {
        gasPrice: await getGasPrice(this.erc20Swap.provider),
      }
    );
  }

  public refundToken = async (
    token: ERC20WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<ContractTransaction> => {
    this.logger.debug(`Refunding ${token.symbol} with preimage hash: ${getHexString(preimageHash)}`);
    return this.erc20Swap.refund(
      preimageHash,
      amount,
      token.getTokenAddress(),
      claimAddress,
      timeLock,
      {
        gasPrice: await getGasPrice(this.erc20Swap.provider),
      }
    );
  }
}

export default ContractHandler;
