import { Arguments } from 'yargs';
import { BigNumber } from 'ethers';
import { etherDecimals } from '../../../consts/Consts';
import { getHexBuffer } from '../../../Utils';
import BuilderComponents from '../../BuilderComponents';
// import { connectEthereum, getContracts } from '../StacksUtils';
// import { queryERC20SwapValues, queryEtherSwapValues } from '../../../wallet/rsk/ContractUtils';

// , TxBroadcastResult,
import { bufferCV, AnchorMode, FungibleConditionCode, PostConditionMode, broadcastTransaction, makeContractCall, makeContractSTXPostCondition } from '@stacks/transactions';
import { StacksMocknet, StacksTestnet, StacksMainnet } from '@stacks/network';
import { getHexString } from '../../../Utils';
import { getAccountNonce } from '../../../wallet/stacks/StacksUtils';
// import { Constants } from '../StacksUtils';
// import axios from 'axios';

const BigNum = require('bn.js');

export const command = 'refund <preimageHash> [token]';

export const describe = 'refunds Stx or a SIP10 token from the corresponding swap contract';

export const builder = {
  preimageHash: {
    describe: 'preimage hash with which the funds have been locked',
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

export const handler = async (argv: Arguments<any>): Promise<void> => {

  // USAGE - straight from lockstx function args
  // ./bin/boltz-stacks refund preimagehash amount refundAddress claimAddress timelock mainnet SP2507VNQZC9VBXM7X7KB4SF4QJDJRSWHG4V39WPY.stxswap_v8 privkey
  
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

  const origpreimageHash = allargs[1].split('x')[1];
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
  console.log(`Refunding ${amount} Stx with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
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

  // (refundStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16))
  const functionArgs = [
    bufferCV(Buffer.from(origpreimageHash, 'hex')),
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
  const accountNonce = await getAccountNonce();
  console.log('got accountNonce ', accountNonce);
  const txOptions = {
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: 'refundStx',
    functionArgs: functionArgs,
    senderKey: privkey,
    validateWithAbi: true,
    network: network,
    postConditions,
    postConditionMode: PostConditionMode.Allow,
    anchorMode: AnchorMode.Any,
    // fee: new BigNum(100000),
    nonce: accountNonce.possible_next_nonce,
    // onFinish: data => {
    //   console.log('Stacks refund Transaction:', JSON.stringify(data));
    //   incrementNonce();
    // }
  };

  // this.logger.error("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

  const transaction = await makeContractCall(txOptions);
  // console.log('transaction: ', transaction);
  const tx = await broadcastTransaction(transaction, network);
  console.log('broadcasted tx: ', tx);

  // const serializedTx = transaction.serialize().toString('hex');
  // console.log('serializedTx: ', serializedTx);
  // let fee = await getFeev2(serializedTx);
  // console.log('got fee: ', fee);

};

// const getFeev2 = async (transaction_payload: string) => {
//   let coreApiUrl = 'https://stacks-node-api.mainnet.stacks.co';
//   try {
//     // console.log("stacksutils.95 getFee ", coreApiUrl);
//     let reqobj = {
//       transaction_payload
//     };
//     const url = `${coreApiUrl}/v2/fees/transaction`;
//     const response = await axios.post(url, reqobj);
//     console.log("stacksutils getFeev2", response.data);
//     return response.data.estimations[0].fee;
//   } catch (e: any) {
//     console.log('error ', e);
//     return "error: " + e;
//   }
// }