// import { getStacksNetwork } from 'lib/wallet/stacks/StacksUtils';
// { makeRequest }
import Exchange from '../Exchange';
// import { Configuration, SmartContractsApi, TransactionsApi } from '@stacks/blockchain-api-client';

import {
  callReadOnlyFunction,
  contractPrincipalCV,
  // stringAsciiCV,
  cvToJSON,
} from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';

const apiUrl = 'https://stacks-node-api.alexlab.co';
const contractAddress = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';
const contractName = 'swap-helper-v1-01';
const functionName = 'oracle-resilient-helper';
// const base = contractPrincipalCV('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', 'token-wbtc');
// const quote = contractPrincipalCV('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', 'token-wxusd');
const network = new StacksMainnet({url: apiUrl});
const senderAddress = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR';

class AlexResillientOracle implements Exchange {
  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    // if(baseAsset !== "BTC" || quoteAsset !== "USDA") {
    //   throw "error";
    // }

    // BTC USDA / XUSD
    // console.log('AlexOracle.45 getPrice baseAsset quoteAsset: ', baseAsset, quoteAsset);
    const options = {
      contractAddress,
      contractName,
      functionName,
      functionArgs: [
        contractPrincipalCV('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', this.longerName(baseAsset)),
        contractPrincipalCV('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', this.longerName(quoteAsset))
      ],
      network,
      senderAddress,
    };
    // console.log('AlexOracle.58 options: ', options, options.functionArgs);
    try {
      const result:any = await callReadOnlyFunction(options);
      // console.log('AlexResilientOracle.62 returning ', baseAsset, quoteAsset, cvToJSON(result).value.value);
      return parseInt(cvToJSON(result).value.value)/10**8;
    } catch(error) {
      throw 'AlexResilientOracle failure';
    }
  }

  private longerName = (asset: string) => {
    switch (asset) {
      case 'BTC': return 'token-wbtc';
      case 'XUSD': return 'token-wxusd';
      case 'USDA': return 'token-wusda';
      case 'STX': return 'token-wstx';

      default: return asset;
    }
  }
}

export default AlexResillientOracle;
