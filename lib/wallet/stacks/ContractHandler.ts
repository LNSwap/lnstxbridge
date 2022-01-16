import { BigNumber, ContractTransaction } from 'ethers';
import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import Logger from '../../Logger';
import { getHexString, stringify } from '../../Utils';
import { getGasPrice, getStacksNetwork } from './StacksUtils';
import ERC20WalletProvider from '../providers/ERC20WalletProvider';
import { etherDecimals, ethereumPrepayMinerFeeGasLimit } from '../../consts/Consts';

// makeContractCall, , broadcastTransaction, makeStandardSTXPostCondition
import { bufferCV, standardPrincipalCV, contractPrincipalCV, AnchorMode, FungibleConditionCode, makeContractSTXPostCondition, PostConditionMode, makeContractCall, broadcastTransaction, TxBroadcastResult } from '@stacks/transactions';
import SIP10WalletProvider from '../providers/SIP10WalletProvider';
// import { contractPrincipalCV } from '@blockstack/stacks-transactions';
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
  private sip10contractAddress!: string;
  private sip10contractName!: string;

  constructor(
    private logger: Logger,
  ) {}

  // etherSwap: EtherSwap, erc20Swap: ERC20Swap
  public init = (contract:string, sip10Contract: string): void => {
    this.contractAddress = contract.split('.')[0];
    this.contractName = contract.split('.')[1];

    this.sip10contractAddress = sip10Contract.split('.')[0];
    this.sip10contractName = sip10Contract.split('.')[1];
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

    amount = amount.div(etherDecimals).div(100);

    // this is wrong we should never add + 1 to anything
    const decimalamount = parseInt(amount.toString(),10);
    this.logger.verbose('contracthandler.65 smaller amount: '+ amount + ', '+ decimalamount);


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

    console.log('contracthandler.85: ',this.contractAddress, this.contractName, postConditionCode, postConditionAmount);

    
    const swapamount = decimalamount.toString(16).split('.')[0] + '';
    const paddedamount = swapamount.padStart(32, '0');
    const tl1 = timeLock.toString(16);
    const tl2 = tl1.padStart(32, '0');
    const tl3 = tl2; // dont slice it?!
    // .slice(2);

    console.log('contracthandler.94: amounts',decimalamount,swapamount,paddedamount);
    console.log('contracthandler.95: timelocks ',timeLock,tl1, tl2, tl3);

    // (lockStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16))
    const functionArgs = [
      bufferCV(preimageHash),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
      standardPrincipalCV(claimAddress),
    ];
    // this.logger.verbose("stacks contracthandler.111 functionargs: "+stringify(functionArgs));

    // const functionArgs = [
    //   bufferCV(preimageHash),
    //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    // ];

    this.logger.verbose('broadcasting with nonce: ' + getStacksNetwork().nonce);
    const stacksNetworkData = getStacksNetwork();
    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'lockStx',
      functionArgs: functionArgs,
      senderKey: stacksNetworkData.privateKey,
      // validateWithAbi: true,
      network: stacksNetworkData.stacksNetwork,
      postConditions,
      postConditionMode: PostConditionMode.Allow,
      anchorMode: AnchorMode.Any,
      // fee: new BigNum(500000),
      nonce: new BigNum(stacksNetworkData.nonce),
      // onFinish: data => {
      //   console.log('Stacks lock Transaction:', JSON.stringify(data));
      //   incrementNonce();
      // }
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
    this.logger.debug(`ch.168 Claiming ${amount} Stx with preimage ${getHexString(preimage)} and timelock ${timeLock}`);
    let decimalamount;
    let theTimelock;

    // from atomic swap
    // Claiming 000000000000000000000000004c4b40 Stx with preimage cdf07179b2ece93ccb76cd4f6fb2ab1c65621c4988bae4f4de8503e64c1eaf0f and timelock 1123
    
    // need to add a way to handle this as well - happens when coming from attemptsettleswap - invoice.pending
    // Claiming 26101488000000000000 Stx with preimage 7a5227e168a41dc5d311e3eacaa8c9a19de070ab5e258134a02b2cdbaa6e00ee and timelock 44337
    if(!amount.toString().includes('0x') && !amount.toString().includes('.') && amount.toString().length < 32) {
      decimalamount = amount.div(10**12).toNumber();
    } else {
      // Claiming 0x000000000000000000000000001e81a1 Stx with preimage 6dbd24b9e7d350d13eae95c218eba735e4a87e3a7ec205b9bd83805a37b4be39 and timelock 0x0000000000000000000000000000abe5
      decimalamount = parseInt(amount.toString(),16);
    }
    if(!timeLock.toString().includes('0x')) {
      theTimelock = timeLock.toString(16).padStart(32, '0')
    } else {
      theTimelock = timeLock;
    }
    this.logger.verbose('theTimelock: ' + theTimelock);

    this.logger.verbose('decimalamount: ' + decimalamount);
    const smallamount = decimalamount;
    // let smallamount = amount.div(etherDecimals).toNumber();
    // this.logger.error("smallamount: " + smallamount)

    // Add an optional post condition
    // See below for details on constructing post conditions
    // const postConditionAddress = this.contractAddress;
    const postConditionCode = FungibleConditionCode.GreaterEqual;
    // new BigNum(1000000);
    const postConditionAmount = new BigNum(decimalamount);
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

    console.log('contracthandler.129 postConditions: ' + postConditions, claimAddress);

    const swapamount = smallamount.toString(16).split('.')[0] + '';
    const paddedamount = swapamount.padStart(32, '0');
    const tl1 = timeLock.toString(16);
    const tl2 = tl1.padStart(32, '0');
    let tl3;
    if(tl2.includes('0x')) {
      tl3 = tl2.slice(2);
    } else {
      tl3 = tl2;
    }
    // console.log('TODO:::: SHOULD NOT BE SLICING THE TIMELOCK!!!!');
    // wrong should be slicing!!!

    const paddedtimelock = timeLock.toString(16).padStart(32, '0');
    console.log('contracthandler.135 ', smallamount, swapamount, paddedamount, timeLock, paddedtimelock, tl1, tl2, tl3);
    // contracthandler.135  1999265 1e81a1 000000000000000000000000001e81a1 0x0000000000000000000000000000abe5 0x0000000000000000000000000000abe5 0x0000000000000000000000000000abe5 0x0000000000000000000000000000abe5 0x0000000000000000000000000000abe5

    this.logger.debug(`ch.209 claimStx functionArgs preimage ${getHexString(preimage)} amount ${paddedamount} timelock ${tl3}`);
    // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)))
    const functionArgs = [
      // bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
      bufferCV(preimage),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
    ];
    this.logger.verbose('stacks contracthandler.198 functionargs: ' + stringify(functionArgs));

    // const functionArgs = [
    //   bufferCV(preimageHash),
    //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    // ];

    const stacksNetworkData = getStacksNetwork();
    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'claimStx',
      functionArgs: functionArgs,
      senderKey: stacksNetworkData.privateKey,
      validateWithAbi: true,
      network: stacksNetworkData.stacksNetwork,
      postConditionMode: PostConditionMode.Allow,
      // postConditions,
      anchorMode: AnchorMode.Any,
      nonce: new BigNum(stacksNetworkData.nonce),
      // fee: new BigNum(150000),
      // onFinish: data => {
      //   console.log('Stacks claim Transaction:', JSON.stringify(data));
      //   incrementNonce();
      // }
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

  public refundStx = async (
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<TxBroadcastResult> => {
    this.logger.debug(`Refunding ${amount} Stx with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
    // Locking 1613451070000000000 Stx with preimage hash: 3149e7d4d658ee7e513c63af7d7d395963141252cb43505e1e4a146fbcbe39e1

    amount = amount.div(etherDecimals).div(100);
    // this +1 causes issues when 49 -> 50
    // removed  + 1
    const decimalamount = parseInt(amount.toString(),10);
    this.logger.verbose('contracthandler.263 smaller amount: '+ amount + ', '+ decimalamount);

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

    console.log('contracthandler.285: ',this.contractAddress, this.contractName, postConditionCode, postConditionAmount);

    const swapamount = decimalamount.toString(16).split('.')[0] + '';
    const paddedamount = swapamount.padStart(32, '0');
    const tl1 = timeLock.toString(16);
    const tl2 = tl1.padStart(32, '0');
    const tl3 = tl2; // dont slice it?!
    // .slice(2);

    console.log('contracthandler.294: amounts',decimalamount,swapamount,paddedamount);
    console.log('contracthandler.295: timelocks ',timeLock,tl1, tl2, tl3);

    // (refundStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16))
    const functionArgs = [
      bufferCV(preimageHash),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
    ];
    this.logger.verbose('stacks contracthandler.306 functionargs: '+stringify(functionArgs));

    // const functionArgs = [
    //   bufferCV(preimageHash),
    //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    // ];

    const stacksNetworkData = getStacksNetwork();
    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'refundStx',
      functionArgs: functionArgs,
      senderKey: stacksNetworkData.privateKey,
      validateWithAbi: true,
      network: stacksNetworkData.stacksNetwork,
      postConditions,
      postConditionMode: PostConditionMode.Allow,
      anchorMode: AnchorMode.Any,
      // fee: new BigNum(150000),
      nonce: new BigNum(stacksNetworkData.nonce),
      // onFinish: data => {
      //   console.log('Stacks refund Transaction:', JSON.stringify(data));
      //   incrementNonce();
      // }
    };

    // this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

    const transaction = await makeContractCall(txOptions);
    return broadcastTransaction(transaction, getStacksNetwork().stacksNetwork);

    // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
    //   value: amount,
    //   gasPrice: await getGasPrice(this.etherSwap.provider),
    // });
  }


  public toObject = (data) => {
    // JSON.parse(
    return JSON.stringify(data, (key, value) => {
        console.log('key, value: ', key, value);
        typeof value === 'bigint'
            ? value.toString()
            : value; // return everything else unchanged
          }
    );
  }

  public lockupToken = async (
    token: SIP10WalletProvider,
    preimageHash: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<TxBroadcastResult> => {
    this.logger.debug(`Locking ${amount} sip10 with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
    // Locking 1613451070000000000 Stx with preimage hash: 3149e7d4d658ee7e513c63af7d7d395963141252cb43505e1e4a146fbcbe39e1

    amount = amount.div(etherDecimals).div(100);
    const decimalamount = parseInt(amount.toString(),10);
    // stop doing this  + 1;
    this.logger.verbose('contracthandler.380 smaller amount: '+ amount + ', '+ decimalamount + ', '+ this.sip10contractAddress);
    //  + ', ' JSON.stringify(token) +

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

    console.log('contracthandler.403: ',this.contractAddress, this.contractName, postConditionCode, postConditionAmount);

    
    const swapamount = decimalamount.toString(16).split('.')[0] + '';
    const paddedamount = swapamount.padStart(32, '0');
    const tl1 = timeLock.toString(16);
    const tl2 = tl1.padStart(32, '0');
    const tl3 = tl2; // dont slice it?!
    // .slice(2);

    console.log('contracthandler.413: amounts',decimalamount,swapamount,paddedamount);
    console.log('contracthandler.414: timelocks ',timeLock,tl1, tl2, tl3);
    // console.log('ch.420 token itself ', token);

    // lockStx (preimageHash (buff 32)) (amount (buff 16)) (tokenAddress (buff 42)) (claimAddress (buff 42)) (timelock (buff 16)) (claimPrincipal principal) (tokenPrincipal <ft-trait>)
  const functionArgs = [
      bufferCV(preimageHash),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
      standardPrincipalCV(claimAddress),
      contractPrincipalCV(token.getTokenContractAddress(),token.getTokenContractName()),
    ];
    // this.logger.verbose("stacks contracthandler.111 functionargs: "+stringify(functionArgs));

    // const functionArgs = [
    //   bufferCV(preimageHash),
    //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    // ];

    this.logger.verbose('ch.436 broadcasting with nonce: ' + getStacksNetwork().nonce);
    const stacksNetworkData = getStacksNetwork();
    const txOptions = {
      contractAddress: this.sip10contractAddress,
      contractName: this.sip10contractName,
      functionName: 'lockToken',
      functionArgs: functionArgs,
      senderKey: stacksNetworkData.privateKey,
      // validateWithAbi: true,
      network: stacksNetworkData.stacksNetwork,
      postConditions,
      postConditionMode: PostConditionMode.Allow,
      anchorMode: AnchorMode.Any,
      // fee: new BigNum(120000),
      nonce: new BigNum(stacksNetworkData.nonce),
      // onFinish: data => {
      //   console.log('Stacks lock Transaction:', JSON.stringify(data));
      //   incrementNonce();
      // }
    };

    // this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

    const transaction = await makeContractCall(txOptions);
    return broadcastTransaction(transaction, getStacksNetwork().stacksNetwork);

    // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
    //   value: amount,
    //   gasPrice: await getGasPrice(this.etherSwap.provider),
    // });
  }

  public claimToken = async (
    token: SIP10WalletProvider,
    preimage: Buffer,
    amount: BigNumber,
    claimAddress: string,
    timeLock: number,
  ): Promise<TxBroadcastResult> => {
    this.logger.debug(`Claiming ${amount} sip10 with preimage ${getHexString(preimage)} and timelock ${timeLock}`);

    const decimalamount = parseInt(amount.toString(),16);
    this.logger.error('decimalamount: ' + decimalamount);
    const smallamount = decimalamount;
    // let smallamount = amount.div(etherDecimals).toNumber();
    // this.logger.error("smallamount: " + smallamount)

    // Add an optional post condition
    // See below for details on constructing post conditions
    // const postConditionAddress = this.contractAddress;
    const postConditionCode = FungibleConditionCode.GreaterEqual;
    // new BigNum(1000000);
    const postConditionAmount = new BigNum(decimalamount);
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

    console.log('contracthandler.129 postConditions: ', postConditions, claimAddress);

    const swapamount = smallamount.toString(16).split('.')[0] + '';
    const paddedamount = swapamount.padStart(32, '0');
    const tl1 = timeLock.toString(16);
    const tl2 = tl1.padStart(32, '0');
    // why slice it?! dont slice it
    // const tl3 = tl2.slice(2);
    const tl3 = tl2;
    const paddedtimelock = timeLock.toString(16).padStart(32, '0');
    console.log('contracthandler.135 ', smallamount, swapamount, paddedamount, timeLock, paddedtimelock, tl1, tl2, tl3);
    // ontracthandler.135  1995106 1e7162 000000000000000000000000001e7162
    // 0x000000000000000000000000000012ea 0x000000000000000000000000000012ea 0x000000000000000000000000000012ea 0x000000000000000000000000000012ea
    // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (tokenPrincipal <ft-trait>))
    const functionArgs = [
      // bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
      bufferCV(preimage),
      bufferCV(Buffer.from(paddedamount,'hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from(tl3,'hex')),
      contractPrincipalCV(token.getTokenContractAddress(), token.getTokenContractName()),
    ];
    this.logger.verbose('stacks contracthandler.523 functionargs: ' + stringify(functionArgs));

    // const functionArgs = [
    //   bufferCV(preimageHash),
    //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('01','hex')),
    //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
    // ];

    const stacksNetworkData = getStacksNetwork();
    const txOptions = {
      contractAddress: this.sip10contractAddress,
      contractName: this.sip10contractName,
      functionName: 'claimToken',
      functionArgs: functionArgs,
      senderKey: stacksNetworkData.privateKey,
      // validateWithAbi: true,
      network: stacksNetworkData.stacksNetwork,
      postConditionMode: PostConditionMode.Allow,
      // postConditions,
      anchorMode: AnchorMode.Any,
      nonce: new BigNum(stacksNetworkData.nonce),
      // onFinish: data => {
      //   console.log('Stacks claim Transaction:', JSON.stringify(data));
      //   incrementNonce();
      // }
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

    public refundToken = async (
      token: SIP10WalletProvider,
      preimageHash: Buffer,
      amount: BigNumber,
      claimAddress: string,
      timeLock: number,
    ): Promise<TxBroadcastResult> => {
      this.logger.debug(`Refunding ${amount} sip10 with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
      // Locking 1613451070000000000 Stx with preimage hash: 3149e7d4d658ee7e513c63af7d7d395963141252cb43505e1e4a146fbcbe39e1

      amount = amount.div(etherDecimals).div(100);
      // this +1 causes issues when 49 -> 50
      // removed  + 1
      const decimalamount = parseInt(amount.toString(),10);
      this.logger.verbose('contracthandler.581 smaller amount: '+ amount + ', '+ decimalamount);

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

      // console.log("contracthandler.603: ",this.contractAddress, this.contractName, postConditionCode, postConditionAmount);

      const swapamount = decimalamount.toString(16).split('.')[0] + '';
      const paddedamount = swapamount.padStart(32, '0');
      const tl1 = timeLock.toString(16);
      const tl2 = tl1.padStart(32, '0');
      const tl3 = tl2; // dont slice it?!
      // .slice(2);

      console.log('contracthandler.612: amounts',decimalamount,swapamount,paddedamount);
      console.log('contracthandler.613: timelocks ',timeLock,tl1, tl2, tl3);

      // (refundStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (tokenPrincipal <ft-trait>))
      const functionArgs = [
        bufferCV(preimageHash),
        bufferCV(Buffer.from(paddedamount,'hex')),
        bufferCV(Buffer.from('01','hex')),
        bufferCV(Buffer.from('01','hex')),
        bufferCV(Buffer.from(tl3,'hex')),
        contractPrincipalCV(token.getTokenContractAddress(), token.getTokenContractName())
      ];
      this.logger.verbose('stacks contracthandler.624 functionargs: '+stringify(functionArgs));

      // const functionArgs = [
      //   bufferCV(preimageHash),
      //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
      //   bufferCV(Buffer.from('01','hex')),
      //   bufferCV(Buffer.from('01','hex')),
      //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
      // ];

      const stacksNetworkData = getStacksNetwork();
      const txOptions = {
        contractAddress: this.sip10contractAddress,
        contractName: this.sip10contractName,
        functionName: 'refundToken',
        functionArgs: functionArgs,
        senderKey: stacksNetworkData.privateKey,
        validateWithAbi: true,
        network: stacksNetworkData.stacksNetwork,
        postConditions,
        postConditionMode: PostConditionMode.Allow,
        anchorMode: AnchorMode.Any,
        // fee: new BigNum(100000),
        nonce: new BigNum(stacksNetworkData.nonce),
        // onFinish: data => {
        //   console.log('Stacks refund Transaction:', JSON.stringify(data));
        //   incrementNonce();
        // }
      };

      // this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

      const transaction = await makeContractCall(txOptions);
      return broadcastTransaction(transaction, getStacksNetwork().stacksNetwork);

      // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
      //   value: amount,
      //   gasPrice: await getGasPrice(this.etherSwap.provider),
      // });
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
    this.logger.debug(`ch.711 Claiming Stx with preimage: ${getHexString(preimage)}`);
    this.logger.error('contracthandler.151 claim data refundAddress: ' + refundAddress);

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

  // public lockupToken = async (
  //   token: ERC20WalletProvider,
  //   preimageHash: Buffer,
  //   amount: BigNumber,
  //   claimAddress: string,
  //   timeLock: number,
  // ): Promise<ContractTransaction> => {
  //   this.logger.debug(`Locking ${amount} ${token.symbol} with preimage hash: ${getHexString(preimageHash)}`);
  //   return this.erc20Swap.lock(
  //     preimageHash,
  //     amount,
  //     token.getTokenAddress(),
  //     claimAddress,
  //     timeLock,
  //     {
  //       gasPrice: await getGasPrice(this.erc20Swap.provider),
  //     }
  //   );
  // }

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

  // public claimToken = async (
  //   token: ERC20WalletProvider,
  //   preimage: Buffer,
  //   amount: BigNumber,
  //   refundAddress: string,
  //   timeLock: number,
  // ): Promise<ContractTransaction> => {
  //   this.logger.debug(`Claiming ${token.symbol} with preimage: ${getHexString(preimage)}`);
  //   return this.erc20Swap.claim(
  //     preimage,
  //     amount,
  //     token.getTokenAddress(),
  //     refundAddress,
  //     timeLock,
  //     {
  //       gasPrice: await getGasPrice(this.erc20Swap.provider),
  //     }
  //   );
  // }

  // public refundToken = async (
  //   token: ERC20WalletProvider,
  //   preimageHash: Buffer,
  //   amount: BigNumber,
  //   claimAddress: string,
  //   timeLock: number,
  // ): Promise<ContractTransaction> => {
  //   this.logger.debug(`Refunding ${token.symbol} with preimage hash: ${getHexString(preimageHash)}`);
  //   return this.erc20Swap.refund(
  //     preimageHash,
  //     amount,
  //     token.getTokenAddress(),
  //     claimAddress,
  //     timeLock,
  //     {
  //       gasPrice: await getGasPrice(this.erc20Swap.provider),
  //     }
  //   );
  // }

}

export default ContractHandler;
