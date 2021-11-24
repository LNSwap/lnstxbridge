import { Arguments } from 'yargs';
import { BigNumber } from 'ethers';
import { getHexBuffer } from '../../../Utils';
import { etherDecimals } from '../../../consts/Consts';
import BuilderComponents from '../../BuilderComponents';
// import { getBoltzAddress } from '../StacksUtils';

import { bufferCV, AnchorMode, FungibleConditionCode, PostConditionMode, makeContractCall, broadcastTransaction, TxBroadcastResult, makeContractSTXPostCondition } from '@stacks/transactions';
import { StacksMocknet, StacksTestnet, StacksMainnet } from '@stacks/network';
import { getHexString } from '../../../Utils';
import { Constants } from '../StacksUtils';

const BigNum = require('bn.js');

let networkconf:string = "mocknet";
let network = new StacksTestnet();
if(networkconf=="mainnet"){
  network = new StacksMainnet();
} else if(networkconf=="mocknet") {
  network = new StacksMocknet()
}

let contractAddress = Constants.stxSwapAddress.split(".")[0]
let contractName = Constants.stxSwapAddress.split(".")[1]

let privkey:string;

export const command = 'lock <preimageHash> <amount> <timelock> [token]';

// or a ERC20 token
export const describe = 'locks Stx in the corresponding swap contract';

export const builder = {
  preimageHash: {
    describe: 'preimage hash with which the funds should be locked',
    type: 'string',
  },
  amount: {
    describe: 'amount of tokens that should be locked up',
    type: 'number',
  },
  timelock: {
    describe: 'timelock delta in blocks',
    type: 'number',
  },
  token: BuilderComponents.token,
};

export const handler = async (argv: Arguments<any>): Promise<void> => {
  // const signer = connectEthereum(argv.provider, argv.signer);
  // const { etherSwap } = getContracts(signer);

  let allargs = process.argv.slice(2);
  // [ 'lock', 'asd', 'qwe', 'zxc' ]
  console.log("stx lock: ", allargs);

  // USAGE
  // ./bin/boltz-stacks lock preimagehash amount refundAddress claimAddress timelock mainnet SP2507VNQZC9VBXM7X7KB4SF4QJDJRSWHG4V39WPY.stxswap_v8 privkey
  
  const selectednetwork = allargs[6]
  if(selectednetwork=="mainnet"){
    network = new StacksMainnet();
  } else if(selectednetwork=="mocknet") {
    network = new StacksMocknet()
  }

  contractAddress = allargs[7].split('.')[0];
  contractName = allargs[7].split('.')[1];
  privkey = allargs[8];

  // const signer = connectEthereum(argv.provider, argv.signer);
  // const { etherSwap, erc20Swap } = getContracts(signer);

  const preimageHash = getHexBuffer(argv.preimageHash);
  // const amount = new BigNumber(allargs[2]);
  const amount = BigNumber.from(allargs[2]).mul(etherDecimals);
  const refundAddress = allargs[3];
  const claimAddress = allargs[4];
  const timelock = parseInt(allargs[5]);
  console.log("stacks cli preimageHash,amount,refundAddress,timelock: ", preimageHash,amount,refundAddress,claimAddress,timelock);


  // const preimageHash = getHexBuffer(argv.preimageHash);
  // const amount = BigNumber.from(argv.amount).mul(etherDecimals);

  // const boltzAddress = await getBoltzAddress();
  // console.log("boltzAddress: ", boltzAddress);

  // if (boltzAddress === undefined) {
  //   console.log('Could not lock coins because the address of LNSwap.org could not be queried');
  //   return;
  // }

  let transaction: TxBroadcastResult;

  // if (argv.token) {
  //   console.log("rsk erc20Swap.lock to erc20SwapAddress: ", Constants.erc20SwapAddress);
  //   await token.approve(Constants.erc20SwapAddress, amount);
  //   console.log("rsk erc20Swap.lock after approve: ", preimageHash, amount, Constants.erc20TokenAddress, boltzAddress, argv.timelock);
  //   transaction = await erc20Swap.lock(
  //     preimageHash,
  //     amount,
  //     Constants.erc20TokenAddress,
  //     boltzAddress,
  //     argv.timelock,
  //   );
  // } else {
    // console.log("rsk etherSwap.lock to claimAddress: ", boltzAddress);

    transaction = await lockupStx(preimageHash, amount, refundAddress, timelock);

  //   transaction = await etherSwap.lock(
  //     preimageHash,
  //     boltzAddress,
  //     argv.timelock,
  //     {
  //       value: amount,
  //     },
  //   );
  // // }

  // await transaction.wait(1);

  console.log(`Sent ${argv.token ? 'ERC20 token' : 'Stx'} in: ${transaction.txid}`);
};

const lockupStx = async (
  preimageHash: Buffer,
  amount: BigNumber,
  claimAddress: string,
  timeLock: number,
): Promise<TxBroadcastResult> => {
  console.log(`Locking ${amount} Stx with preimage hash: ${getHexString(preimageHash)} with claimaddress ${claimAddress}`);
  // Locking 1613451070000000000 Stx with preimage hash: 3149e7d4d658ee7e513c63af7d7d395963141252cb43505e1e4a146fbcbe39e1

  amount = amount.div(etherDecimals)
  let decimalamount = parseInt(amount.toString(),10) + 1
  console.log("lockup.121 smaller amount: "+ amount + ", "+ decimalamount)

  

  // Add an optional post condition
  // See below for details on constructing post conditions
  // const postConditionAddress = this.contractAddress;
  const postConditionCode = FungibleConditionCode.LessEqual;
  // new BigNum(1000000);
  // console.log("contracthandler.71")
  const postConditionAmount = new BigNum(decimalamount*1.1);
  // const postConditions = [
  //   makeStandardSTXPostCondition(postConditionAddress, postConditionCode, postConditionAmount),
  // ];
  // console.log("contracthandler.76")
  const postConditions = [
    makeContractSTXPostCondition(
      contractAddress,
      contractName,
      postConditionCode,
      postConditionAmount
    )
  ];

  console.log("contracthandler.85: ",contractAddress, contractName, postConditionCode, postConditionAmount)
  
  let swapamount = decimalamount.toString(16).split(".")[0] + "";
  let paddedamount = swapamount.padStart(32, "0");
  let tl1 = timeLock.toString(16);
  let tl2 = tl1.padStart(32, "0");
  let tl3 = tl2 // dont slice so it matches
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
  // console.log("stacks contracthandler.80 functionargs: "+stringify(functionArgs));

  // const functionArgs = [
  //   bufferCV(preimageHash),
  //   bufferCV(Buffer.from('00000000000000000000000000100000','hex')),
  //   bufferCV(Buffer.from('01','hex')),
  //   bufferCV(Buffer.from('01','hex')),
  //   bufferCV(Buffer.from('000000000000000000000000000012b3','hex')),
  // ];

  const txOptions = {
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: 'lockStx',
    functionArgs: functionArgs,
    senderKey: privkey,
    validateWithAbi: true,
    network,
    postConditions,
    postConditionMode: PostConditionMode.Allow,
    anchorMode: AnchorMode.Any,
    onFinish: data => {
      console.log('Stacks lock Transaction:', JSON.stringify(data));
    }
  };

  // console.log("stacks contracthandler.84 txOptions: "+ stringify(txOptions));

  const transaction = await makeContractCall(txOptions);
  return broadcastTransaction(transaction, network);

  // return this.etherSwap.lock(preimageHash, claimAddress, timeLock, {
  //   value: amount,
  //   gasPrice: await getGasPrice(this.etherSwap.provider),
  // });
}
