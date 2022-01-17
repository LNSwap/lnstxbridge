import Exchange, { makeRequest } from '../Exchange';

class Okcoin implements Exchange {
  private static readonly API = 'https://www.okcoin.com/api/spot/v3';
  public async getPrice(baseAsset: string, quoteAsset: string): Promise<number> {
    const baseusdrate = await makeRequest(`${Okcoin.API}/instruments/${baseAsset.toUpperCase()}-USD/ticker`);
    const quoteusdrate = await makeRequest(`${Okcoin.API}/instruments/${quoteAsset.toUpperCase()}-USD/ticker`);
    console.log('okcoin.12 returning base, quote ', baseAsset, quoteAsset, baseusdrate.best_ask/quoteusdrate.best_bid);
    return Number(baseusdrate.best_ask/quoteusdrate.best_bid);
  }
}

export default Okcoin;
