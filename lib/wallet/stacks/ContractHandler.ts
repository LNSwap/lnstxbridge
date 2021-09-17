import { BigNumber, ContractTransaction } from 'ethers';
import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import Logger from '../../Logger';
import { getHexString, stringify } from '../../Utils';
import { getGasPrice, getStacksNetwork } from './StacksUtils';
import ERC20WalletProvider from '../providers/ERC20WalletProvider';
import { etherDecimals, ethereumPrepayMinerFeeGasLimit } from '../../consts/Consts';

// makeContractCall, , broadcastTransaction, makeStandardSTXPostCondition
import { bufferCV, AnchorMode, FungibleConditionCode, makeContractSTXPostCondition, PostConditionMode, makeContractCall, broadcastTransaction, TxBroadcastResult } from '@stacks/transactions';
// import { StacksMocknet, StacksTestnet, StacksMainnet } from '@stacks/network';

const BigNum = require('bn.js');

// let networkconf:string = "mocknet";
// let network = new StacksTestnet();
// if(networkconf=="mainnet"){
//   network = new StacksMainnet();
// } else if(networkconf=="mocknet") {
//   network = new StacksMocknet()
// }

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
  ): Promise<TxBroadcastResult> => {
    this.logger.debug(`Locking ${amount} Stx with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
    // Locking 1613451070000000000 Stx with preimage hash: 3149e7d4d658ee7e513c63af7d7d395963141252cb43505e1e4a146fbcbe39e1

    amount = amount.div(etherDecimals).div(100)
    let decimalamount = parseInt(amount.toString(),10) + 1
    this.logger.verbose("contracthandler.65 smaller amount: "+ amount + ", "+ decimalamount)

    

    // Add an optional post condition
    // See below for details on constructing post conditions
    // const postConditionAddress = this.contractAddress;
    const postConditionCode = FungibleConditionCode.LessEqual;
    // new BigNum(1000000);
    // this.logger.error("contracthandler.71")
    const postConditionAmount = new BigNum(decimalamount*1.1);
    // const postConditions = [
    //   makeStandardSTXPostCondition(postConditionAddress, postConditionCode, postConditionAmount),
    // ];
    // this.logger.error("contracthandler.76")
    const postConditions = [
      makeContractSTXPostCondition(
        this.contractAddress,
        this.contractName,
        postConditionCode,
        postConditionAmount
      )
    ];

    console.log("contracthandler.85: ",this.contractAddress, this.contractName, postConditionCode, postConditionAmount)

    
    let swapamount = decimalamount.toString(16).split(".")[0] + "";
    let paddedamount = swapamount.padStart(32, "0");
    let tl1 = timeLock.toString(16);
    let tl2 = tl1.padStart(32, "0");
    let tl3 = tl2 // dont slice it?!
    // .slice(2);

    console.log("contracthandler.94: amounts",decimalamount,swapamount,paddedamount)
    console.log("contracthandler.95: timelocks ",timeLock,tl1, tl2, tl3)

    // (lockStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16))
    const functionArgs = [
      bufferCV(preimageHash),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
    ];
    this.logger.verbose("stacks contracthandler.111 functionargs: "+stringify(functionArgs));

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
      senderKey: getStacksNetwork().privateKey,
      validateWithAbi: true,
      network: getStacksNetwork().stacksNetwork,
      postConditions,
      postConditionMode: PostConditionMode.Allow,
      anchorMode: AnchorMode.Any,
    };

    // this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

    const transaction = await makeContractCall(txOptions);
    return broadcastTransaction(transaction, getStacksNetwork().stacksNetwork);

    // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
    //   value: amount,
    //   gasPrice: await getGasPrice(this.etherSwap.provider),
    // });
  }

  public claimStx = async (
    preimage: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<TxBroadcastResult> => {
    this.logger.debug(`Claiming ${amount} Stx with preimage ${getHexString(preimage)} and timelock ${timeLock}`);

    let decimalamount = parseInt(amount.toString(),16)
    this.logger.error("decimalamount: " + decimalamount)
    let smallamount = decimalamount
    // let smallamount = amount.div(etherDecimals).toNumber();
    // this.logger.error("smallamount: " + smallamount)

    // Add an optional post condition
    // See below for details on constructing post conditions
    // const postConditionAddress = this.contractAddress;
    const postConditionCode = FungibleConditionCode.GreaterEqual;
    // new BigNum(1000000);
    const postConditionAmount = new BigNum(100000);
    // const postConditions = [
    //   makeStandardSTXPostCondition(postConditionAddress, postConditionCode, postConditionAmount),
    // ];

    const postConditions = [
      makeContractSTXPostCondition(
        this.contractAddress,
        this.contractName,
        postConditionCode,
        postConditionAmount
      )
    ];

    console.log("contracthandler.129 postConditions: " + postConditions, claimAddress)

    let swapamount = smallamount.toString(16).split(".")[0] + "";
    let paddedamount = swapamount.padStart(32, "0");
    let tl1 = timeLock.toString(16);
    let tl2 = tl1.padStart(32, "0");
    let tl3 = tl2.slice(2);
    let paddedtimelock = timeLock.toString(16).padStart(32, "0");
    console.log("contracthandler.135 ", smallamount, swapamount, paddedamount, timeLock, paddedtimelock, tl1, tl2, tl3);
    // ontracthandler.135  1995106 1e7162 000000000000000000000000001e7162 
    // 0x000000000000000000000000000012ea 0x000000000000000000000000000012ea 0x000000000000000000000000000012ea 0x000000000000000000000000000012ea
    // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)))
    const functionArgs = [
      // bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
      bufferCV(preimage),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
    ];
    this.logger.verbose("stacks contracthandler.198 functionargs: " + stringify(functionArgs));

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
      functionName: 'claimStx',
      functionArgs: functionArgs,
      senderKey: getStacksNetwork().privateKey,
      validateWithAbi: true,
      network: getStacksNetwork().stacksNetwork,
      postConditionMode: PostConditionMode.Allow,
      postConditions,
      anchorMode: AnchorMode.Any,
      onFinish: data => {
        console.log('Stacks claim Transaction:', JSON.stringify(data));
      }
    };

    // this.toObject(txOptions)
    // console.log("stacks contracthandler.84 txOptions: " + this.toObject(txOptions));

    const transaction = await makeContractCall(txOptions);
    return broadcastTransaction(transaction, getStacksNetwork().stacksNetwork);

    

    // this is from connect
    // return await openContractCall(txOptions);

    // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
    //   value: amount,
    //   gasPrice: await getGasPrice(this.etherSwap.provider),
    // });
  }

  public toObject = (data) => {
    // JSON.parse(
    return JSON.stringify(data, (key, value) => {
        console.log("key, value: ", key, value)
        typeof value === 'bigint'
            ? value.toString()
            : value // return everything else unchanged
          }
    );
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
  ): Promise<TxBroadcastResult> => {
    this.logger.debug(`Claiming Stx with preimage: ${getHexString(preimage)}`);
    this.logger.error("contracthandler.151 claim data refundAddress: " + refundAddress);

    return this.claimStx(preimage, amount, refundAddress, timelock);


    // return this.etherSwap.claim(
    //   preimage,
    //   amount,
    //   refundAddress,
    //   timelock,
    //   {
    //     gasPrice: await getGasPrice(this.etherSwap.provider),
    //   }
    // );
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
