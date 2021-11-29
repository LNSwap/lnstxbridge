import { BigNumber, providers } from 'ethers';
import GasNow from './GasNow';
import { etherDecimals, gweiDecimals } from '../../consts/Consts';
import { getBiggerBigNumber, getHexBuffer } from '../../Utils';
// import { RPCClient } from '@stacks/rpc-client';
import axios from 'axios';
import { connectWebSocketClient } from '@stacks/blockchain-api-client';
// TransactionsApi
import type { Transaction } from '@stacks/stacks-blockchain-api-types';
import { estimateContractFunctionCall } from '@stacks/transactions';

import { bufferCV, 
  standardPrincipalCV, 
  AnchorMode, 
  FungibleConditionCode, 
  makeContractSTXPostCondition, 
  createSTXPostCondition,
  PostConditionMode, 
  makeContractCall } from '@stacks/transactions';
import { StacksMocknet, StacksTestnet, StacksMainnet, StacksNetwork } from '@stacks/network';
import { StacksConfig } from 'lib/Config';
import { EtherSwapValues, Sip10SwapValues } from 'lib/consts/Types';

const BigNum = require('bn.js');

let stacksNetwork:StacksNetwork = new StacksMainnet()
// let coreApiUrl = 'https://stacks-node-api.mainnet.stacks.co';
// let wsUrl = 'wss://stacks-node-api.mainnet.stacks.co/extended/v1/ws';

// public instances seem to have socket timeout :(
// so we always use local instance for both coreapiurl and ws - only set network type depending on the provider endpoint name
let coreApiUrl = 'http://localhost:3999';
let wsUrl = 'ws://localhost:3999/extended/v1/ws'; 
let stxSwapAddress = "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3";
let privateKey = '';
let signerAddress = 'SP13R6D5P5TYE71D81GZQWSD9PGQMQQN54A2YT3BY';
let nonce = 0;
let blockHeight = 0;
let tokens;

// const apiConfig = new Configuration({
//   // fetchApi: fetch,
//   // basePath: "https://stacks-node-api.blockstack.org"
//   basePath: coreApiUrl
// });

/**
 * Removes the 0x prefix of the Ethereum bytes
 */
export const parseBuffer = (input: string): Buffer => {
  return getHexBuffer(input.slice(2));
};

/**
 * Formats the gas provided price or queries an estimation from the web3 provider
 *
 * @param provider web3 provider
 * @param gasPrice denominated in GWEI
 */
export const getGasPrice = async (provider: providers.Provider, gasPrice?: number): Promise<BigNumber> => {
  if (gasPrice !== undefined) {
    return BigNumber.from(gasPrice).mul(gweiDecimals);
  }

  return getBiggerBigNumber(await provider.getGasPrice(), GasNow.latestGasPrice);
};

export const getAddressBalance = async (address:string) => {
  console.log("started getAddressBalance ", coreApiUrl);
  // coreApiUrl = stacksNetwork.coreApiUrl;

  // const address = "ST15RGYVK9ACFQWMFFA2TVASDVZH38B4VAV4WF6BJ"
  const url = `${coreApiUrl}/extended/v1/address/${address}/balances`;
  const response = await axios.get(url)
  // const data = await response.json();
  // works!!!
  console.log("stacksutls  48 test", response.data);
  return response.data.stx.balance;

  // {
  //   stx: {
  //     balance: '297884327',
  //     total_sent: '203145729',
  //     total_received: '501048577',
  //     total_fees_sent: '18521',
  //     total_miner_rewards_received: '0',
  //     lock_tx_id: '',
  //     locked: '0',
  //     lock_height: 0,
  //     burnchain_lock_height: 0,
  //     burnchain_unlock_height: 0
  //   },
  //   fungible_tokens: {},
  //   non_fungible_tokens: {}
  // }
  
}

export const getAddressAllBalances = async (initAddress?:string) => {
  let queryAddress = signerAddress;
  if(initAddress !== undefined){
    queryAddress = initAddress;
  }
  const url = `${coreApiUrl}/extended/v1/address/${queryAddress}/balances`;
  // console.log("started getAddressAllBalances ", url);
  const response = await axios.get(url)
  // console.log("getAddressAllBalances ", response.data, response.data.stx);
  // console.log("getAddressAllBalances tokens", tokens);
  const usdaContractAddress = tokens.find((item) => item.symbol === 'USDA').contractAddress;
  let respobj = {STX: response.data.stx.balance};
  if (JSON.stringify(response.data.fungible_tokens).length > 2) {
    respobj["USDA"] = response.data.fungible_tokens[usdaContractAddress+'::usda'].balance;
  }
  return respobj;

  // tokens: [
  //   { symbol: 'STX', maxSwapAmount: 1294967000, minSwapAmount: 10000 },
  //   {
  //     symbol: 'USDA',
  //     maxSwapAmount: 1294967000,
  //     minSwapAmount: 10000,
  //     contractAddress: 'ST30VXWG00R13WK8RDXBSTHXNWGNKCAQTRYEMA9FK.usda-token',
  //     decimals: 6
  //   }
  // ]

  // {
  //   "stx": {
  //     "balance": "118709701",
  //     "total_sent": "340166824",
  //     "total_received": "461761138",
  //     "total_fees_sent": "2884613",
  //     "total_miner_rewards_received": "0",
  //     "lock_tx_id": "",
  //     "locked": "0",
  //     "lock_height": 0,
  //     "burnchain_lock_height": 0,
  //     "burnchain_unlock_height": 0
  //   },
  //   "fungible_tokens": {
  //     "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token::usda": {
  //       "balance": "22199244",
  //       "total_sent": "1998954",
  //       "total_received": "24198198"
  //     }
  //   },
  //   "non_fungible_tokens": {}
  // }
  
}

export const setStacksNetwork = (network: string, stacksConfig: StacksConfig, derivedPrivateKey: string, derivedSignerAddress: string, signerNonce: number, currentBlockHeight: number) => {
  // let network:string = "mocknet";
 
  if (network.includes("localhost")) {
    coreApiUrl = 'http://localhost:3999';
    wsUrl = 'ws://localhost:3999/extended/v1/ws'
    stacksNetwork = new StacksMocknet()
  } else if (network.includes('testnet')) {
    // coreApiUrl = 'https://stacks-node-api.testnet.stacks.co';
    // wsUrl = 'wss://stacks-node-api.testnet.stacks.co/extended/v1/ws'
    stacksNetwork = new StacksTestnet()
  } else if (network.includes('regtest')) {
    // coreApiUrl = 'https://stacks-node-api.regtest.stacks.co';
    // stacksNetwork = new StacksRegtest()
    stacksNetwork = new StacksMocknet()
  } else if (network.includes('mainnet')) {
    stacksNetwork = new StacksMainnet()
  }

  stxSwapAddress = stacksConfig.stxSwapAddress;
  privateKey = derivedPrivateKey;
  signerAddress = derivedSignerAddress;
  nonce = signerNonce;
  blockHeight = currentBlockHeight;
  tokens = stacksConfig.tokens;

  return {'stacksNetwork': stacksNetwork, 'wsUrl': wsUrl, 'coreApiUrl': coreApiUrl, 'providerEndpoint': network, 'privateKey': privateKey, 'signerAddress': signerAddress, 'nonce': nonce, 'blockHeight': blockHeight};
}

export const getStacksNetwork = () => {
  return {'stacksNetwork': stacksNetwork, 'wsUrl': wsUrl, 'coreApiUrl': coreApiUrl, 'stxSwapAddress': stxSwapAddress, 'privateKey': privateKey, 'signerAddress': signerAddress, 'nonce': nonce, 'blockHeight': blockHeight};
}

export const getFee = async () => {
  // console.log("stacksutils.95 getFee ", coreApiUrl);
  const url = `${coreApiUrl}/v2/fees/transfer`;
  const response = await axios.get(url)
  // console.log("stacksutils  getFee", response.data);
  
  // const STX_TRANSFER_TX_SIZE_BYTES = 180;
  // const fee = new BigNumber(feeRate.data).multipliedBy(STX_TRANSFER_TX_SIZE_BYTES);
  return BigNumber.from(response.data).mul(gweiDecimals);
  // return response.data;
}

export const getFeev2 = async (transaction_payload: string) => {
  
  try {
    // console.log("stacksutils.95 getFee ", coreApiUrl);
    let reqobj = {
      transaction_payload
    };
    const url = `${coreApiUrl}/v2/fees/transaction`;
    const response = await axios.post(url, reqobj);
    console.log("stacksutils getFeev2", response.data);
    return response.data.estimations[0].fee;
  } catch (e: any) {
    return "error: " + e.reason;
  }
}

export const getInfo = async () => {
  const url = `${coreApiUrl}/v2/info`;
  const response = await axios.get(url)
  // console.log("stacksutils getInfo", response.data);
  return response.data;
}

export const setBlockHeight = (currentBlockHeight: number) => {
  blockHeight = currentBlockHeight;
}

export const getAccountInfo = async (initAddress: string) => {
  let queryAddress = signerAddress;
  if(initAddress !== undefined){
    queryAddress = initAddress;
  }
  // console.log(`getAccountInfo ${queryAddress}`);
  const url = `${coreApiUrl}/v2/accounts/${queryAddress}?proof=0`;
  try {
    const response = await axios.get(url)
    // console.log("stacksutils getInfo", response.data);
    return response.data;
  } catch (e) {
    console.log(`getAccountInfo error: `, e);
    return {nonce: 0};
  } 
}

export const getAccountNonce = async (initAddress?: string) => {
  let queryAddress = signerAddress;
  if(initAddress !== undefined){
    queryAddress = initAddress;
  }
  // console.log(`getAccountInfo ${queryAddress}`);
  // https://stacks-node-api.mainnet.stacks.co/extended/v1/address/{principal}/nonces
  const url = `${coreApiUrl}/extended/v1/address/${queryAddress}/nonces`;
  try {
    const response = await axios.get(url)
    // console.log("stacksutils getAccountNonce", response.data);
    if (response.data.possible_next_nonce > nonce) {
      console.log('getAccountNonce updating nonce: ', response.data.possible_next_nonce);
      nonce = response.data.possible_next_nonce;
    }
    return response.data;
  } catch (e) {
    console.log(`getAccountNonce error: `, e);
    return {possible_next_nonce: 0};
  } 
}

export const incrementNonce = () => {
  nonce = nonce + 1;
}

export const getTx = async (txid:string) => {
  const url = `${coreApiUrl}/extended/v1/tx/${txid}`;
  const response = await axios.get(url)
  return response.data;
}

export const getTransaction = async (txid:string): Promise<Transaction> => {
  const url = `${coreApiUrl}/extended/v1/tx/${txid}`;
  const response = await axios.get(url)
  return response.data;
}

export const getStacksRawTransaction = async (txid:string) => {
  const url = `${coreApiUrl}/extended/v1/tx/${txid}/raw`;
  const response = await axios.get(url)
  return response.data.raw_tx;
}

export const querySwapValuesFromTx = async (txid:string): Promise<EtherSwapValues> => {
  const url = `${coreApiUrl}/extended/v1/tx/${txid}`;
  const response = await axios.get(url)
  const txData = response.data;

  // if(txData.contract_call.function_name.includes("lock")){
    let preimageHash = txData.contract_call.function_args.filter(a=>a.name=="preimageHash")[0].repr
    let amount = txData.contract_call.function_args.filter(a=>a.name=="amount")[0].repr
    amount = BigNumber.from(amount).mul(etherDecimals).mul(100);
    let claimAddress = txData.contract_call.function_args.filter(a=>a.name=="claimAddress")[0].repr
    let refundAddress = txData.contract_call.function_args.filter(a=>a.name=="refundAddress")[0].repr
    let timelock = txData.contract_call.function_args.filter(a=>a.name=="timelock")[0].repr
    timelock = parseInt(timelock.toString(10));
    console.log("lockFound fetched from Tx: ", preimageHash,amount,claimAddress,refundAddress,timelock);

  // } else if(txData.contract_call.function_name.includes("claim")){

  // } else {
  //   // refundStx call

  // }

  return {
    amount: amount,
    claimAddress: claimAddress,
    refundAddress: refundAddress,
    timelock: timelock,
    preimageHash: parseBuffer(preimageHash),
  };
}

export const querySip10SwapValuesFromTx = async (txid:string): Promise<Sip10SwapValues> => {
  const url = `${coreApiUrl}/extended/v1/tx/${txid}`;
  const response = await axios.get(url)
  const txData = response.data;

  // console.log('sip10valuesfromtx: ', txData.contract_call.function_args);

  let preimageHash = txData.contract_call.function_args.filter(a=>a.name=="preimageHash")[0].repr
  let amount = txData.contract_call.function_args.filter(a=>a.name=="amount")[0].repr
  amount = BigNumber.from(amount).mul(etherDecimals).mul(100);
  let claimAddress = txData.contract_call.function_args.filter(a=>a.name=="claimAddress")[0].repr
  // let refundAddress = txData.contract_call.function_args.filter(a=>a.name=="refundAddress")[0].repr
  let timelock = txData.contract_call.function_args.filter(a=>a.name=="timelock")[0].repr
  let claimPrincipal = txData.contract_call.function_args.filter(a=>a.name=="claimPrincipal")[0].repr
  let tokenPrincipal = txData.contract_call.function_args.filter(a=>a.name=="tokenPrincipal")[0].repr
  timelock = parseInt(timelock.toString(10));
  console.log("querySip10SwapValuesFromTx fetched from Tx: ", preimageHash,amount,claimAddress,timelock, claimPrincipal, tokenPrincipal);

  return {
    amount: amount,
    claimAddress: claimAddress,
    timelock: timelock,
    preimageHash: parseBuffer(preimageHash),
    claimPrincipal,
    tokenPrincipal,
  };
}

export const getStacksContractTransactions = async (address:string, limit?:number, offset?:number, height?:number) => {

  if(height==0){
    return [];
  }

  let url = `${coreApiUrl}/extended/v1/address/${address}/transactions?limit=${limit}&height=${height}`;
  if(offset){
    url = url + "&offset="+offset;
  }
  // console.log("getStacksContractTransactions url", url);
  const response = await axios.get(url)
  // console.log("getStacksContractTransactions ", response.data);
  return response.data.results;
}


export const listenContract = async (address:string) => {
  const client = await connectWebSocketClient(wsUrl);
  console.log("stackutils.94 started listening to txns for ", address);
  await client.subscribeAddressTransactions(address, event => {
    console.log("stackutils.95 got event ", event);
  });
  /*
    {
      address: 'ST3GQB6WGCWKDNFNPSQRV8DY93JN06XPZ2ZE9EVMA',
      tx_id: '0x8912000000000000000000000000000000000000000000000000000000000000',
      tx_status: 'success',
      tx_type: 'token_transfer',
    }
  */
}

export const calculateStacksTxFee = async (contract:string, functionName:string) => {
  // STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3_debug
  let contractAddress = contract.split(".")[0];
  let contractName = contract.split(".")[1];

  const postConditionCode = FungibleConditionCode.GreaterEqual;
  const postConditionAmount = new BigNum(100000);
  const postConditions = [
    makeContractSTXPostCondition(
      contractAddress,
      contractName,
      postConditionCode,
      postConditionAmount
    )
  ];

  // Successful claim tx
  // 0xfcd0617b0cbabe3a49028d48e544d1510caee1dac31aba29dcecb410e23a4cec
  // amount
  // 0x0000000000000000000000000018b1df
  // claimAddress
  // 0x01
  // refundAddress
  // 0x01
  // timelock
  // 0x0000000000000000000000000000405a

  let functionArgs: any[] = [];
  if(functionName.includes("lockStx")) {
    functionArgs = [
      bufferCV(Buffer.from('fcd0617b0cbabe3a49028d48e544d1510caee1dac31aba29dcecb410e23a4cec', 'hex')),
      bufferCV(Buffer.from('0000000000000000000000000018b1df','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('0000000000000000000000000000405a','hex')),
      standardPrincipalCV('ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF'),
    ];
  } else {
    // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)))
    functionArgs = [
      bufferCV(Buffer.from('fcd0617b0cbabe3a49028d48e544d1510caee1dac31aba29dcecb410e23a4cec', 'hex')),
      bufferCV(Buffer.from('0000000000000000000000000018b1df','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('0000000000000000000000000000405a','hex')),
    ];
  }

  // console.log("stacksutil.231 functionargs: ", functionName, JSON.stringify(functionArgs));

  const txOptions = {
    contractAddress,
    contractName,
    functionName,
    functionArgs: functionArgs,
    senderKey: getStacksNetwork().privateKey,
    validateWithAbi: true,
    network: stacksNetwork,
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
  // console.log("stacksutil.209 transaction: ", transaction)

  // to see the raw serialized tx
  const serializedTx = transaction.serialize();
  // .toString('hex');
  console.log('serializedTx and byteLength ', serializedTx, serializedTx.byteLength);

  // resolves to number of microstacks per byte!!!
  const estimateFee = await estimateContractFunctionCall(transaction, stacksNetwork);
  
  // I think we need to serialize and get the length in bytes and multiply with base fee rate.
  const totalfee = BigNumber.from(serializedTx.byteLength).mul(estimateFee);

  console.log("estimatedFee, totalfee: ", estimateFee, totalfee);
  return Number(totalfee);
}

export const calculateStxLockFee = async (contract:string, preimageHash: string) => {
  // STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3_debug
  let contractAddress = contract.split(".")[0];
  let contractName = contract.split(".")[1];

  const postConditionCode = FungibleConditionCode.GreaterEqual;
  const postConditionAmount = new BigNum(100000);
  const postConditions = [
    createSTXPostCondition(contract, postConditionCode, postConditionAmount),
    // makeStandardSTXPostCondition(
    //   contractAddress,
    //   contractName,
    //   postConditionCode,
    //   postConditionAmount
    // )
  ];

  let functionArgs = [
    bufferCV(Buffer.from(preimageHash, 'hex')),
    bufferCV(Buffer.from('0000000000000000000000000018b1df','hex')),
    bufferCV(Buffer.from('01','hex')),
    bufferCV(Buffer.from('01','hex')),
    bufferCV(Buffer.from('0000000000000000000000000000405a','hex')),
    standardPrincipalCV('ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF'),
  ];

  // console.log("stacksutil.231 functionargs: ", functionName, JSON.stringify(functionArgs));

  const txOptions = {
    contractAddress,
    contractName,
    functionName: 'lockStx',
    functionArgs: functionArgs,
    senderKey: getStacksNetwork().privateKey,
    validateWithAbi: true,
    network: stacksNetwork,
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
  // console.log("stacksutil.209 transaction: ", transaction)

  // to see the raw serialized tx
  const serializedTx = transaction.serialize();
  // .toString('hex');
  console.log('serializedTx and byteLength ', serializedTx, serializedTx.byteLength);

  // resolves to number of microstacks per byte!!!
  const estimateFee = await estimateContractFunctionCall(transaction, stacksNetwork);
  
  // I think we need to serialize and get the length in bytes and multiply with base fee rate.
  const totalfee = BigNumber.from(serializedTx.byteLength).mul(estimateFee);

  console.log("estimatedFee, totalfee: ", estimateFee, totalfee);
  return Number(totalfee);
}

export const calculateStxClaimFee = async (contract:string, preimage: string, amount: string, timelock: string) => {
  // STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3_debug
  let contractAddress = contract.split(".")[0];
  let contractName = contract.split(".")[1];

  const postConditionCode = FungibleConditionCode.GreaterEqual;
  const postConditionAmount = new BigNum(100000);
  const postConditions = [
    makeContractSTXPostCondition(
      contractAddress,
      contractName,
      postConditionCode,
      postConditionAmount
    )
  ];

  let functionArgs = [
    bufferCV(Buffer.from(preimage, 'hex')),
    bufferCV(Buffer.from(amount,'hex')),
    bufferCV(Buffer.from('01','hex')),
    bufferCV(Buffer.from('01','hex')),
    bufferCV(Buffer.from(timelock,'hex')),
  ];

  // console.log("stacksutil.231 functionargs: ", functionName, JSON.stringify(functionArgs));

  const txOptions = {
    contractAddress,
    contractName,
    functionName: 'claimStx',
    functionArgs: functionArgs,
    senderKey: getStacksNetwork().privateKey,
    validateWithAbi: true,
    network: stacksNetwork,
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
  // console.log("stacksutil.209 transaction: ", transaction)

  // to see the raw serialized tx
  const serializedTx = transaction.serialize();
  // .toString('hex');
  console.log('serializedTx and byteLength ', serializedTx, serializedTx.byteLength);

  // resolves to number of microstacks per byte!!!
  const estimateFee = await estimateContractFunctionCall(transaction, stacksNetwork);
  
  // I think we need to serialize and get the length in bytes and multiply with base fee rate.
  const totalfee = BigNumber.from(serializedTx.byteLength).mul(estimateFee);

  console.log("estimatedFee, totalfee: ", estimateFee, totalfee);
  return Number(totalfee);
}

// window is not defined?! -- I think we can use cross-fetch but meh no need.
// export const getInfo = async () => {
//   const infoApi = new InfoApi(apiConfig)
//   const info = await infoApi.getCoreApiInfo()
//   console.log("getNewInfo: ", info)
//   return info;
// }

// export const getFee = async () => {
//   const feesApi = new FeesApi(apiConfig)
//   const fee = await feesApi.getFeeTransfer()
//   console.log("getNewFee: ", fee)
//   return fee;
// }

// export const getTransaction = async (txid:Transaction) => {
//   const transactionApi = new TransactionsApi(apiConfig)
//   const fee = await transactionApi.getTransactionById(txid)
//   console.log("getNewFee: ", fee)
//   return fee;
// }