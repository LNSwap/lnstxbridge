import Exchange, { makeRequest } from '../Exchange';

class Binance implements Exchange {
  private static readonly API = 'https://api.binance.com/api/v3';

  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    // const response = await makeRequest(`${Binance.API}/ticker/price?symbol=${baseAsset.toUpperCase()}${quoteAsset.toUpperCase()}`);
    // if(!response.price) {
      const baseusdtrate = await makeRequest(`${Binance.API}/ticker/price?symbol=${baseAsset.toUpperCase()}USDT`);
      const quoteusdtrate = await makeRequest(`${Binance.API}/ticker/price?symbol=${quoteAsset.toUpperCase()}USDT`);
      return Number(baseusdtrate.price/quoteusdtrate.price);
    // } else {
    //   return Number(response.price);
    // }
  }
}

export default Binance;
