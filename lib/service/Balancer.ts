import Logger from '../Logger';
const { PublicClient } = require("@pseudozach/okex-node");
// const { V3WebsocketClient } = require("@pseudozach/okex-node");
const { AuthenticatedClient } = require("@pseudozach/okex-node");
// const pClient = new PublicClient();
// const wss = new V3WebsocketClient();

class Balancer {
  public pClient = new PublicClient();
  public authClient: any;
  private apiKey: string;
  private tradePassword: string;
  private smallerRate: number;

  constructor(private logger: Logger, apiUri: string, apiKey: string, secretKey: string, passphrase: string, tradePassword: string,) {
    this.apiKey = apiKey;
    this.tradePassword = tradePassword;
    this.authClient = new AuthenticatedClient(apiKey, secretKey, passphrase, apiUri);
    this.smallerRate = 0.95;
  }

  public getExchangeBalance = async (currency: string): Promise<string> => {
    if (this.apiKey === '') {
      throw new Error('no API key provided');
    }
    // get account + balances
    const accounts = await this.authClient.spot().getAccounts();
    // console.log('accounts ', accounts);
    const currencyAccount = accounts.find((item) => item.currency === currency);
    const currencyBalance = currencyAccount['available'];
    console.log('balancer.22 getExchangeBalance ', currencyBalance, currency, this.tradePassword);
    return currencyBalance;
  }

  /**
   * Checks if balancing is needed based on pre-set limits
   */
  public checkBalancer = async (params: any): Promise<void> => {
    
  }

  /**
   * Triggers automated balancing via centralized exchange APIs
   */
  public balanceFunds = async (params: any): Promise<{result: string, status: string}> => {
    if (this.apiKey === '') {
      throw new Error('no API key provided');
    }
    this.logger.debug('Balancer.18 start');

    const sellCurrency = params.pairId.split('/')[0];
    const buyCurrency = params.pairId.split('/')[1];
    
    // // get current price
    // const orderbook = await this.pClient.spot().getSpotBook("BTC-USD", {"size":"10"});
    // console.log('orderbook ', orderbook);
    
    const sellRate = (await this.pClient.spot().getSpotTicker(`${sellCurrency}'-USD`))['ask'];
    const buyRate = (await this.pClient.spot().getSpotTicker(`${buyCurrency}'-USD`))['bid'];
    
    // calculate amount to sell to end up with target buy amount
    const sellBalance = await this.getExchangeBalance(sellCurrency);
    const smallerBuyAmount = params.buyAmount * this.smallerRate;
    const usdTopup = params.buyAmount * buyRate
    const smallerUsdTopup = usdTopup * this.smallerRate;
    const sellAmount = usdTopup / sellRate;

    if(sellCurrency === 'BTC') {
      // get ln invoice
      const invoiceResult = await this.authClient.account().getInvoice(sellAmount)
      console.log('invoice ', invoiceResult['invoice']);

      // send payment - deposit to exchange
      // pay ln invoice
      if(!invoiceResult.payment_preimage) {
        this.logger.error('invoice payment failed');
        // check if succeeded otherwise try depositing onchain btc?
        
      }

      const sellResult = await this.authClient.swap().postOrder({"size":sellAmount, "type":"market", "side":"sell", "order_type": "0", "instrument_id":`${sellCurrency}-USD`});
      console.log('balancer.76 sellResult ', sellResult);
      if(!sellResult.result) {
        throw new Error('sell order failed')
      }

      // buy target currency with smaller usd equivalent
      const buyResult = await this.authClient.swap().postOrder({"notional":smallerUsdTopup, "type":"market", "side":"buy", "order_type": "0", "instrument_id":`${buyCurrency}-USD`});
      console.log('postOrder buyResult ', buyResult);
      if(!buyResult.result) {
        throw new Error('buy order failed')
      }

      // transfer funds for withdrawal
      const transferResult = await this.authClient.swap().postTransfer({"currency":buyCurrency, "amount":smallerBuyAmount, "account_from":"1", "account_to": "6"});
      console.log('postTransfer transferResult ', transferResult);
      if(!transferResult.result) {
        throw new Error('transfer failed')
      }

      // find minimum withdrawal fee for buyCurrency
      const feeResult = await this.authClient.account().getWithdrawalFee(buyCurrency);
      console.log('postTransfer feeResult ', feeResult);
      if(!feeResult.result) {
        throw new Error('fee retrieval failed')
      }

      // withdraw to signer wallet
      const withdrawResult = await this.authClient.swap().postWithdrawal({"currency":buyCurrency, "amount":smallerBuyAmount, "destination":"4", "to_address": signeraddress, "trade_pwd": this.tradePassword, "fee": feeResult[0]['min_fee']});
      console.log('postTransfer withdrawResult ', withdrawResult);
      if(!withdrawResult.result) {
        throw new Error('withdrawal failed')
      }
      
      return {
        status: "OK",
        result: "successful",
      }
    
    } else {
      // get stx address and deposit
      return {
        status: "OK",
        result: "successful",
      }
    }

    // topuptarget = 50 
    // signeraddress = 'SP13R6D5P5TYE71D81GZQWSD9PGQMQQN54A2YT3BY:a'
    // # check if less than 200, top up to 250
    // if signerbalance < 25:
    //     print('signer balance is low ' + str(signerbalance))
    //     logging.info('signer balance is low ' + str(signerbalance))
    //     stxtopup = topuptarget - signerbalance
    //     smallerstxtopup = stxtopup * 0.95
    //     usdtopup = stxtopup * stxusdrate
    //     smallerusdtopup = usdtopup * 0.95
    //     btctopup = usdtopup / btcusdrate

    // # get rates
    // let result = await pClient.spot().getSpotTicker('BTC-USD')
    // const btcusdrate = result["bid"]
    // result = await pClient.spot().getSpotTicker('STX-USD')
    // const stxusdrate = result["ask"]
    // console.log('btcusdrate, stxusdrate ', btcusdrate, stxusdrate)



    // get btc address
    // result = await authClient.account().getAddress('BTC')
    // const btcaddress = result.find((item) => item.chain === 'BTC-Bitcoin');
    // const btcdepositaddress = btcaddress['address'];
    // console.log('btcdepositaddress ', btcdepositaddress);


  }
}

export default Balancer;