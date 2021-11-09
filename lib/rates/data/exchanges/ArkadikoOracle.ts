// import { getStacksNetwork } from 'lib/wallet/stacks/StacksUtils';
import Exchange, { makeRequest } from '../Exchange';
// import { Configuration, SmartContractsApi, TransactionsApi } from '@stacks/blockchain-api-client';

import {
  callReadOnlyFunction,
  stringAsciiCV,
  cvToJSON,
} from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';

const contractAddress = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR';
const contractName = 'arkadiko-oracle-v1-1';
const functionName = 'get-price';
const buffer = stringAsciiCV('USDA');
const network = new StacksMainnet();
const senderAddress = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR';

const options = {
  contractAddress,
  contractName,
  functionName,
  functionArgs: [buffer],
  network,
  senderAddress,
};

class ArkadikoOracle implements Exchange {
  // https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
  // https://explorer.stacks.co/address/SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-oracle-v1-1?chain=mainnet
  private static readonly API = 'https://api.coingecko.com/api/v3';

  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    if(baseAsset !== "BTC" || quoteAsset !== "USDA") {
      throw "error";
    }
    // BTC USDA
    console.log("ArkadikoOracle.10 getPrice baseAsset quoteAsset: ", baseAsset, quoteAsset);
    let longerquoteasset = this.longerName(quoteAsset);
    let longerbaseasset = this.longerName(baseAsset);
    // let lowerbaseasset = baseAsset.toLowerCase();
    // let lowerbaseasset = this.longerName(baseAsset);
    const pair = `${longerbaseasset}&vs_currencies=${longerquoteasset}`;
    console.log(`Arkadiko.42 pair `, `${ArkadikoOracle.API}/simple/price?ids=${pair}`)
    const response = await makeRequest(`${ArkadikoOracle.API}/simple/price?ids=${pair}`);
    console.log("response: ", response, response[longerbaseasset]);
    const lastprice = response[longerbaseasset][longerquoteasset];
    // 68318
    console.log("ArkadikoOracle.18 btc lastprice: ", lastprice);

    const result:any = await callReadOnlyFunction(options);
    console.log(`ArkadikoOracle.45 getPrice: `, result, cvToJSON(result));

    let usdaperusd = Number(result.data['last-price'].value)/Number(result.data['decimals'].value)
    let btcperusda = lastprice / usdaperusd;
    console.log(`ArkadikoOracle.45 getPrice: `, result, usdaperusd, btcperusda)
    
    // 1 stx = 3000 sats
    // 1 btc = 33156.498673740054 STX -> this is returned from here which is correct on frontend UI
    return Number(btcperusda);

    // const lastTrade = (Object.values(response['result'])[0] as Record<string, string[]>)['c'];

    // return Number(lastTrade[0]);
  }

  private longerName = (asset: string) => {
    switch (asset) {
      case 'SOV': return 'sovryn';
      case 'ETH': return 'ethereum';
      case 'BTC': return 'bitcoin';
      case 'RBTC': return 'rootstock';
      case 'STX': return 'blockstack';
      case 'USDA': return 'usd';

      default: return asset;
    }    
  }

  // private parseAsset = (asset: string) => {
  //   const assetUpperCase = asset.toUpperCase();

  //   switch (assetUpperCase) {
  //     case 'USDA': return 'usd';
  //     default: return assetUpperCase;
  //   }
  // }
}

export default ArkadikoOracle;
