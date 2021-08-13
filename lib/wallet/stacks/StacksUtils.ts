import { BigNumber, providers } from 'ethers';
import GasNow from './GasNow';
import { gweiDecimals } from '../../consts/Consts';
import { getBiggerBigNumber, getHexBuffer } from '../../Utils';
// import { RPCClient } from '@stacks/rpc-client';
import axios from 'axios';
// import { Configuration, FeesApi, InfoApi } from '@stacks/blockchain-api-client';

let network:string = "testnet";
let coreApiUrl = 'https://stacks-node-api.mainnet.stacks.co';
if (network.includes('mocknet')) {
  coreApiUrl = 'http://localhost:20080';
  // coreApiUrl = 'https://dull-liger-41.loca.lt';
} else if (network.includes('testnet')) {
  coreApiUrl = 'https://stacks-node-api.testnet.stacks.co';
} else if (network.includes('regtest')) {
  coreApiUrl = 'https://stacks-node-api.regtest.stacks.co';
}

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
  console.log("started TEST");
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

export const getFee = async () => {
  const url = `${coreApiUrl}/v2/fees/transfer`;
  const response = await axios.get(url)
  // console.log("stacksutils  getFee", response.data);
  return response.data;
}
export const getInfo = async () => {
  const url = `${coreApiUrl}/v2/info`;
  const response = await axios.get(url)
  // console.log("stacksutils getInfo", response.data);
  return response.data;
}


// window is not defined?!
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