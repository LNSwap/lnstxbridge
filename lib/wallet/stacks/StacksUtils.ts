import { BigNumber, providers } from 'ethers';
import GasNow from './GasNow';
import { gweiDecimals } from '../../consts/Consts';
import { getBiggerBigNumber, getHexBuffer } from '../../Utils';
// import { RPCClient } from '@stacks/rpc-client';
import axios from 'axios';
import { connectWebSocketClient } from '@stacks/blockchain-api-client';
// TransactionsApi
import type { Transaction } from '@stacks/stacks-blockchain-api-types';
import { estimateContractFunctionCall } from '@stacks/transactions';

import { bufferCV, standardPrincipalCV, AnchorMode, FungibleConditionCode, makeContractSTXPostCondition, PostConditionMode, makeContractCall } from '@stacks/transactions';
import { StacksMocknet, StacksTestnet, StacksMainnet, StacksNetwork } from '@stacks/network';
import { StacksConfig } from 'lib/Config';

const BigNum = require('bn.js');

let stacksNetwork:StacksNetwork = new StacksMainnet()
// let coreApiUrl = 'https://stacks-node-api.mainnet.stacks.co';
// let wsUrl = 'wss://stacks-node-api.mainnet.stacks.co/extended/v1/ws';

// public instances seem to have socket timeout :(
// so we always use local instance for both coreapiurl and ws - only set network type depending on the provider endpoint name
let coreApiUrl = 'http://localhost:3999';
let wsUrl = 'ws://localhost:3999/extended/v1/ws'; 
let stxSwapAddress = "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3";
let privateKey = 'f4ab2357a4d008b4d54f3d26e8e72eef72957da2bb8f51445176d733f65a7ea501';

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

export const setStacksNetwork = (network: string, stacksConfig: StacksConfig, derivedPrivateKey: string) => {
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

  return {'stacksNetwork': stacksNetwork, 'wsUrl': wsUrl, 'coreApiUrl': coreApiUrl, 'providerEndpoint': network, 'privateKey': privateKey};
}

export const getStacksNetwork = () => {
  return {'stacksNetwork': stacksNetwork, 'wsUrl': wsUrl, 'coreApiUrl': coreApiUrl, 'stxSwapAddress': stxSwapAddress, 'privateKey': privateKey};
}

export const getFee = async () => {
  // console.log("stacksutils.95 getFee ", coreApiUrl);
  const url = `${coreApiUrl}/v2/fees/transfer`;
  const response = await axios.get(url)
  // console.log("stacksutils  getFee", response.data);
  return BigNumber.from(response.data).mul(gweiDecimals);
  // return response.data;
}
export const getInfo = async () => {
  const url = `${coreApiUrl}/v2/info`;
  const response = await axios.get(url)
  // console.log("stacksutils getInfo", response.data);
  return response.data;
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

  var functionArgs: any[] = [];
  if(functionName=="lockStx") {
    const spCV = standardPrincipalCV("ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF");
    functionArgs = [
      bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
      bufferCV(Buffer.from('fcd0617b0cbabe3a49028d48e544d1510caee1dac31aba29dcecb410e23a4cec', 'hex')),
      bufferCV(Buffer.from('0000000000000000000000000018b1df','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('0000000000000000000000000000405a','hex')),
      spCV,
    ];
  } else {
    // (claimStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)))
    functionArgs = [
      // bufferCV(Buffer.from('4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', 'hex')),
      bufferCV(Buffer.from('fcd0617b0cbabe3a49028d48e544d1510caee1dac31aba29dcecb410e23a4cec', 'hex')),
      bufferCV(Buffer.from('0000000000000000000000000018b1df','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('01','hex')),
      bufferCV(Buffer.from('0000000000000000000000000000405a','hex')),
    ];
  }

  // console.log("stacksutil.187 functionargs: " + JSON.stringify(functionArgs));

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
  const estimateFee = await estimateContractFunctionCall(transaction, stacksNetwork);
  // console.log("estimatedFee: ", estimateFee);
  return Number(estimateFee);
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