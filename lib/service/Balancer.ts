import Logger from '../Logger';
const { PublicClient } = require("@pseudozach/okex-node");
// const { V3WebsocketClient } = require("@pseudozach/okex-node");
const { AuthenticatedClient } = require("@pseudozach/okex-node");
// const pClient = new PublicClient();
// const wss = new V3WebsocketClient();

class Balancer {
  public pClient = new PublicClient();

  public authClient: any;

  constructor(private logger: Logger, apiUri: string, apiKey: string, secretKey: string, passphrase: string) {
    this.authClient = new AuthenticatedClient(apiKey, secretKey, passphrase, apiUri);
  }

  /**
   * Triggers automated balancing via centralized exchange APIs
   */
  public balanceFunds = async (): Promise<void> => {
    this.logger.debug('Balancer.18 start');

    const orderbook = await this.pClient.spot().getSpotBook("BTC-USDT", {"size":"10"});
    console.log('orderbook ', orderbook);
    
    // get account + balances
    // const accounts = await authClient.spot().getAccounts();
    // // console.log('accounts ', accounts);
    // const stxaccount = accounts.find((item) => item.currency === 'STX');
    // const initialstxbalance = stxaccount['available'];
    // console.log('initialstxbalance ', initialstxbalance);


    // # get rates
    // let result = await pClient.spot().getSpotTicker('BTC-USD')
    // const btcusdrate = result["bid"]
    // result = await pClient.spot().getSpotTicker('STX-USD')
    // const stxusdrate = result["ask"]
    // console.log('btcusdrate, stxusdrate ', btcusdrate, stxusdrate)

    // get ln invoice
    // const invoiceAmount = 0.00001000;
    // result = await authClient.account().getInvoice(invoiceAmount)
    // console.log('invoice ', result['invoice']);

    // get btc address
    // result = await authClient.account().getAddress('BTC')
    // const btcaddress = result.find((item) => item.chain === 'BTC-Bitcoin');
    // const btcdepositaddress = btcaddress['address'];
    // console.log('btcdepositaddress ', btcdepositaddress);

    // // sell btc
    // const btctopup = 0.00000010
    // result = await authClient.swap().postOrder({"size":btctopup, "type":"market", "side":"sell", "order_type": "0", "instrument_id":"BTC-USD"});
    // console.log('postOrder result ', result);
    // // result['result'] != True:

    // // buy stx
    // const smallerusdtopup = 1
    // result = await authClient.swap().postOrder({"notional":btctopup, "type":"market", "side":"buy", "order_type": "0", "instrument_id":"STX-USD"});
    // console.log('postOrder result ', result);
    // // result['result'] != True:

    // # should have required funds now
    // result = spotAPI.get_account_info()
    // print("spotAPI.get_account_info: " + time + json.dumps(result))
    // logging.info("spotAPI.get_account_info: " + time + json.dumps(result))

    // transfer funds for withdrawal
    // const smallerstxtopup = 1
    // result = await authClient.swap().postTransfer({"currency":"STX", "amount":smallerstxtopup, "account_from":"1", "account_to": "6"});
    // console.log('postTransfer result ', result);
    // // result['result'] != True:

    // check finalstxbalance
    // const accounts = await authClient.spot().getAccounts();
    // // console.log('accounts ', accounts);
    // const stxaccount = accounts.find((item) => item.currency === 'STX');
    // const finalstxbalance = stxaccount['available'];
    // console.log('finalstxbalance ', finalstxbalance);

    // withdraw to signer wallet
    // result = await authClient.swap().postWithdrawal({"currency":"STX", "amount":smallerstxtopup, "destination":"4", "to_address": signeraddress, "trade_pwd": tradepassword, "fee": "0.5"});
    // console.log('postTransfer result ', result);
    // // result['result'] != True:
  }
}
