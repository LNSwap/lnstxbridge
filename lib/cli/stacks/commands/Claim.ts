import { Arguments } from 'yargs';
// import { crypto } from 'bitcoinjs-lib';
// import { ContractTransaction } from 'ethers';
import { getHexBuffer } from '../../../Utils';
import BuilderComponents from '../../BuilderComponents';
// import { Constants } from '../StacksUtils';
// import { queryEtherSwapValues } from '../../../wallet/rsk/ContractUtils';
// queryERC20SwapValues
import { etherDecimals } from '../../../consts/Consts';

import { BigNumber } from 'ethers';
// import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
// import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
// import Logger from '../../Logger';
// import { getHexString, stringify } from '../../Utils';
// import { getGasPrice } from './StacksUtils';
// import ERC20WalletProvider from '../providers/ERC20WalletProvider';
// import { ethereumPrepayMinerFeeGasLimit } from '../../consts/Consts';

// makeContractCall, , broadcastTransaction, estimateContractFunctionCall
import { bufferCV, AnchorMode, FungibleConditionCode, PostConditionMode, makeContractCall, broadcastTransaction, makeContractSTXPostCondition } from '@stacks/transactions';
import { StacksMocknet, StacksTestnet, StacksMainnet } from '@stacks/network';
import { getHexString } from '../../../Utils';
import { getAccountNonce } from '../../../wallet/stacks/StacksUtils';
// import StacksManager from '../../../wallet/stacks/StacksManager';

const BigNum = require('bn.js');

// let networkconf:string = "mocknet";
// let network = new StacksTestnet();
// if(networkconf=="mainnet"){
//   network = new StacksMainnet();
// } else if(networkconf=="mocknet") {
//   network = new StacksMocknet()
// }

// const contractAddress = Constants.stxSwapAddress.split(".")[0]
// const contractName = Constants.stxSwapAddress.split(".")[1]

export const command = 'claim <preimage> [token]';

// or a ERC20 token
export const describe = 'claims Stx from the corresponding swap contract';

export const builder = {
  preimage: {
    describe: 'preimage with which the funds have been locked',
    type: 'string',
  },
  token: BuilderComponents.token,
};

let networkconf:string = "mocknet";
let network = new StacksTestnet();
if(networkconf=="mainnet"){
  network = new StacksMainnet();
} else if(networkconf=="mocknet") {
  network = new StacksMocknet()
}

let contractAddress:string;
let contractName:string;
let privkey:string;
let customfee:number;
let customnonce:number;

export const handler = async (argv: Arguments<any>): Promise<void> => {

  // USAGE - straight from lockstx function args
  // ./bin/boltz-stacks claim preimage amount refundAddress claimAddress timelock mainnet SP2507VNQZC9VBXM7X7KB4SF4QJDJRSWHG4V39WPY.stxswap_v8 privkey <customfee in microstx> <customnonce>
  // ./bin/boltz-stacks claim 0xc6213f3f2635186d9fa4fd00173eac5f2d71aacabf07f0a178de9961d4020331 0x00000000000000000000000003937005 0x01 0x01 0x00000000000000000000000000009485 mainnet SP2507VNQZC9VBXM7X7KB4SF4QJDJRSWHG4V39WPY.stxswap_v8 "xxx" 500000 55

  let allargs = process.argv.slice(2);
  // [ 'lock', 'asd', 'qwe', 'zxc' ]
  console.log("stx refund: ", allargs, argv);

  const selectednetwork = allargs[6]
  if(selectednetwork=="mainnet"){
    network = new StacksMainnet();
  } else if(selectednetwork=="mocknet") {
    network = new StacksMocknet()
  }

  contractAddress = allargs[7].split('.')[0];
  contractName = allargs[7].split('.')[1];
  privkey = allargs[8];
  customfee = 90000;
  if (allargs[9]) {
    customfee = parseInt(allargs[9]);
  }

  const accountNonce = await getAccountNonce();
  customnonce = accountNonce.possible_next_nonce;
  if (allargs[10]) {
    customnonce = parseInt(allargs[10]);
  }

  const origpreimage = allargs[1].split('x')[1];
  const preimageHash = getHexBuffer(allargs[1]);
  // const amount = new BigNumber(allargs[2]);
  let origamount = allargs[2].split('x')[1];
  let amount = BigNumber.from(allargs[2]).mul(etherDecimals);
  const refundAddress = allargs[3];
  const claimAddress = allargs[4];
  const timelock = parseInt(allargs[5]);
  const origtimelock = allargs[5].split('x')[1];
  console.log("stacks cli preimageHash,amount,refundAddress,timelock: ", preimageHash,amount,refundAddress,claimAddress,timelock);

  // return;



  // 50755270000000000
  console.log(`claiming ${amount} Stx with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
  // Locking 1613451070000000000 Stx with preimage hash: 3149e7d4d658ee7e513c63af7d7d395963141252cb43505e1e4a146fbcbe39e1

  amount = amount.div(etherDecimals).div(100)
  // this +1 causes issues when 49 -> 50
  // removed  + 1
  let decimalamount = parseInt(amount.toString(),10)
  console.log("contracthandler.263 smaller amount: "+ amount + ", "+ decimalamount)

  // Add an optional post condition
  // See below for details on constructing post conditions
  // const postConditionAddress = this.contractAddress;
  const postConditionCode = FungibleConditionCode.LessEqual;
  // new BigNum(1000000);
  // this.logger.error("contracthandler.71")
  const postConditionAmount = new BigNum(decimalamount*1.1*100);
  // const postConditions = [
  //   makeStandardSTXPostCondition(postConditionAddress, postConditionCode, postConditionAmount),
  // ];
  // this.logger.error("contracthandler.76")
  const postConditions = [
    makeContractSTXPostCondition(
      contractAddress,
      contractName,
      postConditionCode,
      postConditionAmount
    )
  ];

  console.log("contracthandler.285: ",contractAddress, contractName, postConditionCode, postConditionAmount)

  let swapamount = decimalamount.toString(16).split(".")[0] + "";
  let paddedamount = swapamount.padStart(32, "0");
  let tl1 = timelock.toString(16);
  let tl2 = tl1.padStart(32, "0");
  let tl3 = tl2 // dont slice it?!
  // .slice(2);

  console.log("contracthandler.294: amounts",decimalamount,swapamount,paddedamount)
  console.log("contracthandler.295: timelocks ",timelock,tl1, tl2, tl3)

  // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)))
  const functionArgs = [
    bufferCV(Buffer.from(origpreimage, 'hex')),
    bufferCV(Buffer.from(origamount,'hex')),
    bufferCV(Buffer.from('01','hex')),
    bufferCV(Buffer.from('01','hex')),
    bufferCV(Buffer.from(origtimelock,'hex')),
  ];
  console.log("stacks contracthandler.306 functionargs: " + JSON.stringify(functionArgs));

  // const functionArgs = [
  //   bufferCV(preimageHash),
  //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
  //   bufferCV(Buffer.from('01','hex')),
  //   bufferCV(Buffer.from('01','hex')),
  //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
  // ];

  // const stacksNetworkData = getStacksNetwork();
  
  // console.log('got accountNonce ', accountNonce);
  const txOptions = {
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: 'claimStx',
    functionArgs: functionArgs,
    senderKey: privkey,
    validateWithAbi: true,
    network: network,
    postConditions,
    postConditionMode: PostConditionMode.Allow,
    anchorMode: AnchorMode.Any,
    fee: new BigNum(customfee),
    nonce: new BigNum(customnonce),
    // onFinish: data => {
    //   console.log('Stacks refund Transaction:', JSON.stringify(data));
    //   incrementNonce();
    // }
  };

  // this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

  const transaction = await makeContractCall(txOptions);
  // console.log('transaction: ', transaction);

  // // fee calculation!
  // // to see the raw serialized tx
  // const serializedTx = transaction.serialize();
  // // .toString('hex');
  // console.log('serializedTx and byteLength ', serializedTx, serializedTx.byteLength);
  // // resolves to number of microstacks per byte!!!
  // const estimateFee = await estimateContractFunctionCall(transaction, network);
  // // I think we need to serialize and get the length in bytes and multiply with base fee rate.
  // const totalfee = BigNumber.from(serializedTx.byteLength).mul(estimateFee);
  // console.log("estimatedFee, totalfee, customfee: ", estimateFee, totalfee, customfee);
  // // return;

  const tx = await broadcastTransaction(transaction, network);
  console.log('broadcasted tx: ', tx);

  // const serializedTx = transaction.serialize().toString('hex');
  // console.log('serializedTx: ', serializedTx);
  // let fee = await getFeev2(serializedTx);
  // console.log('got fee: ', fee);

};


// export const handler = async (argv: Arguments<any>): Promise<void> => {

//   // console.log("stx claim: ", argv.provider, argv.signer, argv, argv._);
//   // console.log(process.argv.slice(2))
//   let allargs = process.argv.slice(2);
//   console.log("stx claim: ", allargs);
//   // const signer = connectEthereum(argv.provider, argv.signer);
//   // const { etherSwap, erc20Swap } = getContracts(signer);

//   const preimage = getHexBuffer(argv.preimage);
//   // const amount = new BigNumber(allargs[2]);\
//   const amount = BigNumber.from(allargs[2]).mul(etherDecimals);
//   const refundAddress = allargs[3];
//   const claimAddress = allargs[4];
//   const timelock = parseInt(allargs[5]);
//   console.log("stacks cli preimage,amount,refundAddress,timelock: ", preimage,amount,refundAddress,claimAddress,timelock);

//   // let transactionold: ContractTransaction;
//   let transaction: TxBroadcastResult;

//   // if (argv.token) {
//   //   console.log("1stacks sip10 claim erc20SwapValues: ", argv.token, JSON.stringify(erc20Swap));

//   //   // // const erc20SwapValues = await queryERC20SwapValues(erc20Swap, crypto.sha256(preimage));
//   //   // const erc20SwapValues = await queryERC20SwapValues(erc20Swap, preimage);
//   //   // console.log("rerc20 claim erc20SwapValues: ", JSON.stringify(erc20SwapValues));
//   //   // transaction = await erc20Swap.claim(
//   //   //   preimage,
//   //   //   erc20SwapValues.amount,
//   //   //   erc20SwapValues.tokenAddress,
//   //   //   erc20SwapValues.refundAddress,
//   //   //   erc20SwapValues.timelock,
//   //   // );

//   //   // manual claim
//   //   transactionold = await erc20Swap.claim(
//   //     preimage,
//   //     112279872,
//   //     "0x9f84F92d952f90027618089F6F2a3481f1a3fa0F",
//   //     "0xe142868123ab36a88f86a8f5cd08a77e9225da60",
//   //     297071,
//   //   );
//   // } else {
//     // console.log("stx claim to refundaddress: ", JSON.stringify(etherSwap));
//     // const etherSwapValues = await queryEtherSwapValues(etherSwap, crypto.sha256(preimage));
//     // console.log("stx claim to refundaddress: ", etherSwapValues.refundAddress)

//     transaction = await claimStx(preimage, amount, refundAddress, timelock);


//     // transaction = await etherSwap.claim(
//     //   preimage,
//     //   etherSwapValues.amount,
//     //   etherSwapValues.refundAddress,
//     //   etherSwapValues.timelock,
//     // );
//   // }

//   console.log("waiting some more ", transaction.txid, JSON.stringify(transaction));
//   // await transaction.wait(1);
//   // console.log("after waiting some more");
//   console.log(`Claimed ${argv.token ? 'ERC20 token' : 'Stx'} in: ${transaction.txid}`);
// };

// const claimStx = async (
//   preimage: Buffer,
//   amount: BigNumber,
//   claimAddress: string,
//   timeLock: number,
// ): Promise<TxBroadcastResult> => {
//   console.log(`Claiming ${amount} Stx with preimage ${getHexString(preimage)} and timelock ${timeLock}`);

//   // this is wrong
//   let decimalamount = parseInt(amount.toString(),16)
//   console.log("amount, decimalamount: ", amount, decimalamount)
//   // let smallamount = decimalamount
//   let smallamount = amount.div(etherDecimals).toNumber();
//   console.log("smallamount: " + smallamount)

//   // // Add an optional post condition
//   // // See below for details on constructing post conditions
//   // const postConditionAddress = contractAddress;
//   const postConditionCode = FungibleConditionCode.GreaterEqual;
//   // // new BigNum(1000000);
//   const postConditionAmount = new BigNum(100000);
//   // const postConditions = [
//   //   makeStandardSTXPostCondition(postConditionAddress, postConditionCode, postConditionAmount),
//   // ];

//   // With a contract principal
//   // const contractAddress = 'SPBMRFRPPGCDE3F384WCJPK8PQJGZ8K9QKK7F59X';
//   // const contractName = 'test-contract';

//   const postConditions = [
//     makeContractSTXPostCondition(
//       contractAddress,
//       contractName,
//       postConditionCode,
//       postConditionAmount
//     )
//   ];

//   console.log("postConditions: " + toObject(postConditions), claimAddress)

//   let swapamount = smallamount.toString(16).split(".")[0] + "";
//   let paddedamount = swapamount.padStart(32, "0");
//   let paddedtimelock = timeLock.toString(16).padStart(32, "0");
//   console.log("stackscli claim.143 ", smallamount, swapamount, paddedamount, paddedtimelock);

//   // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)))
//   const functionArgs = [
//     // bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
//     bufferCV(preimage),
//     bufferCV(Buffer.from(paddedamount,'hex')),
//     bufferCV(Buffer.from('01','hex')),
//     bufferCV(Buffer.from('01','hex')),
//     bufferCV(Buffer.from(paddedtimelock,'hex')),
//   ];
//   console.log("stacks cli claim.154 functionargs: " + JSON.stringify(functionArgs));

//   // const functionArgs = [
//   //   bufferCV(preimageHash),
//   //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
//   //   bufferCV(Buffer.from('01','hex')),
//   //   bufferCV(Buffer.from('01','hex')),
//   //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
//   // ];

//   const txOptions = {
//     contractAddress: contractAddress,
//     contractName: contractName,
//     functionName: 'claimStx',
//     functionArgs: functionArgs,
//     senderKey: 'f4ab2357a4d008b4d54f3d26e8e72eef72957da2bb8f51445176d733f65a7ea501',
//     // senderKey: StacksManager
//     validateWithAbi: true,
//     network,
//     postConditionMode: PostConditionMode.Allow,
//     postConditions,
//     anchorMode: AnchorMode.Any,
//     onFinish: data => {
//       console.log('Stacks claim Transaction:', JSON.stringify(data));
//     }
//   };

//   // this.toObject(txOptions)
//   console.log("stackscli claim.170 txOptions: " + toObject(txOptions));

//   const transaction = await makeContractCall(txOptions);
//   return broadcastTransaction(transaction, network);
 

//   // this is from connect
//   // return await openContractCall(txOptions);

//   // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
//   //   value: amount,
//   //   gasPrice: await getGasPrice(this.etherSwap.provider),
//   // });
// }

// const toObject = (data) => {
//   // JSON.parse(
//   return JSON.stringify(data, (key, value) => {
//       if (typeof value === 'undefined') {
//         console.log("key, value: ", key, value)
//       }
      
//       typeof value === 'bigint'
//           ? value.toString()
//           : value // return everything else unchanged
//         }
//   );
// }
