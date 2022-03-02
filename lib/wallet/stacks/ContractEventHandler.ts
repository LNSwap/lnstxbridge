import { EventEmitter } from 'events';
// import { BigNumber, Event } from 'ethers';
// import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
// import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import Logger from '../../Logger';
import { parseBuffer, getTx, getInfo, getStacksContractTransactions, getStacksNetwork } from './StacksUtils';
import { ERC20SwapValues, EtherSwapValues } from '../../consts/Types';
// import { formatERC20SwapValues, formatEtherSwapValues } from './ContractUtils';
// StacksApiSocketClient
import { connectWebSocketClient, } from '@stacks/blockchain-api-client';
import { getHexBuffer, getHexString, stringify } from '../../../lib/Utils';
import { crypto } from 'bitcoinjs-lib';
// import ChainTipRepository from 'lib/db/ChainTipRepository';

// testing socket.io client to see if it receives contracttx in microblocks
// import { io } from 'socket.io-client';
// const socket = io(getStacksNetwork().coreApiUrl, {
//   query: {
//     subscriptions: Array.from(new Set(['address-transaction'])).join(','),
//   },
//   transports: [ 'websocket' ]
// });
// const sc = new StacksApiSocketClient(socket);

// let network:string = "mocknet";
// let wsUrl = 'wss://stacks-node-api.mainnet.stacks.co/extended/v1/ws'
// if (network.includes('testnet')) {
//   wsUrl = 'wss://stacks-node-api.testnet.stacks.co/extended/v1/ws'
// } else if(network.includes("mocknet")){
//   wsUrl = "ws://localhost:3999/extended/v1/ws"
// }

interface ContractEventHandler {
  // EtherSwap contract events
  on(event: 'eth.lockup', listener: (transactionHash: string, etherSwapValues: EtherSwapValues) => void): this;
  emit(event: 'eth.lockup', transactionHash: string, etherSwapValues: EtherSwapValues): boolean;

  on(event: 'eth.claim', listener: (transactionHash: string, preimageHash: Buffer, preimage: Buffer) => void): this;
  emit(event: 'eth.claim', transactionHash: string, preimageHash: Buffer, preimage: Buffer): boolean;

  on(event: 'eth.refund', listener: (transactionHash: string, preimageHash: Buffer) => void): this;
  emit(event: 'eth.refund', transactionHash: string, preimageHash: Buffer): boolean;

  // ERC20Swap contract events
  on(event: 'erc20.lockup', listener: (transactionHash: string, erc20SwapValues: ERC20SwapValues) => void): this;
  emit(event: 'erc20.lockup', transactionHash: string, erc20SwapValues: ERC20SwapValues): boolean;

  // SIP10 contract events
  on(event: 'sip10.lockup', listener: (transactionHash: string, erc20SwapValues: ERC20SwapValues, claimPrincipal: string, tokenPrincipal: string) => void): this;
  emit(event: 'sip10.lockup', transactionHash: string, erc20SwapValues: ERC20SwapValues, claimPrincipal: string, tokenPrincipal: string): boolean;

  on(event: 'erc20.claim', listener: (transactionHash: string, preimageHash: Buffer, preimage: Buffer) => void): this;
  emit(event: 'erc20.claim', transactionHash: string, preimageHash: Buffer, preimage: Buffer): boolean;

  on(event: 'erc20.refund', listener: (transactionHash: string, preimageHash: Buffer) => void): this;
  emit(event: 'erc20.refund', transactionHash: string, preimageHash: Buffer): boolean;
}

class ContractEventHandler extends EventEmitter {
  // private etherSwap!: EtherSwap;
  // private erc20Swap!: ERC20Swap;
  private contractAddress!: string;
  private contractName!: string;
  private sip10contractAddress!: string;
  private sip10contractName!: string;

  constructor(
    private logger: Logger,
  ) {
    super();
  }

  // etherSwap: EtherSwap, erc20Swap: ERC20Swap
  public init = (contract:string, sip10contract:string): void => {
    this.contractAddress = contract.split('.')[0];
    this.contractName = contract.split('.')[1];
    this.sip10contractAddress = sip10contract.split('.')[0];
    this.sip10contractName = sip10contract.split('.')[1];

    this.logger.debug('stacks contracteventhandler.init: '+ this.contractAddress + '.' + this.contractName + ' on ' + getStacksNetwork().wsUrl);

    // this.etherSwap = etherSwap;
    // this.erc20Swap = erc20Swap;

    this.logger.verbose('Stacks Starting contract event subscriptions');
    this.subscribeContractEvents(contract);
    this.subscribeTokenContractEvents(sip10contract);
  }

  public rescan = async (startHeight: number): Promise<void> => {
    // since Stacks do not have queryfilters/swap contract types etc.
    // fetch each block since last chaintip and search for any lockup/claim/refund event signatures in a loop

    const contract = this.contractAddress + '.' + this.contractName;
    const stacksInfo = await getInfo();
    const currentTip = stacksInfo.stacks_tip_height;

    for (let index = startHeight; index < currentTip; index++) {
      // this.logger.error(`ceh.79 rescan loop ${index}`);
      const stacksBlockResults = await getStacksContractTransactions(contract,1,undefined,index);
      // this.logger.error(`ceh.82 stacksBlockResults ` + JSON.stringify(stacksBlockResults));

      for (let k = 0; k < stacksBlockResults.length; k++) {
        const tx = stacksBlockResults[k];
        if(tx.tx_status && tx.tx_status === 'success' && tx.tx_type === 'contract_call'){
          this.logger.verbose(`ceh.86 contractcall during rescan ${index} ` + JSON.stringify(stacksBlockResults));
          // go get the event? - no need checkTx already emits required events!
          this.checkTx(tx.tx_id);

          // let func_args = tx.contract_call.function_args; // array of inputs
          // let events = (await getTx(tx.tx_id)).events;
          // this.logger.debug("got events: "+ events + ", " + func_args);
          // // TODO: parse events and emit stuff!!!
        }
        //  else {
        //   this.logger.debug('no tx.tx_status ' + JSON.stringify(tx));
        // }
      }

      // same rescan for sip10token contract
      const sip10contract = this.sip10contractAddress + '.' + this.sip10contractName;
      const sip10stacksBlockResults = await getStacksContractTransactions(sip10contract,1,undefined,index);
      // this.logger.error(`ceh.82 stacksBlockResults ` + JSON.stringify(stacksBlockResults));

      for (let k = 0; k < sip10stacksBlockResults.length; k++) {
        const tx = sip10stacksBlockResults[k];
        if(tx.tx_status && tx.tx_status === 'success' && tx.tx_type === 'contract_call'){
          this.logger.error(`ceh.110 contractcall during rescan ${index} ` + JSON.stringify(sip10stacksBlockResults));
          // go get the event? - no need checkTx already emits required events!
          this.checkTokenTx(tx.tx_id);

          // let func_args = tx.contract_call.function_args; // array of inputs
          // let events = (await getTx(tx.tx_id)).events;
          // this.logger.debug("got events: "+ events + ", " + func_args);
          // // TODO: parse events and emit stuff!!!
        }
        //  else {
        //   this.logger.debug('no tx.tx_status ' + JSON.stringify(tx));
        // }
      }

    }


    // const etherLockups = await this.etherSwap.queryFilter(
    //   this.etherSwap.filters.Lockup(null, null, null, null, null),
    //   startHeight,
    // );

    // const etherClaims = await this.etherSwap.queryFilter(
    //   this.etherSwap.filters.Claim(null, null),
    //   startHeight,
    // );

    // const etherRefunds = await this.etherSwap.queryFilter(
    //   this.etherSwap.filters.Refund(null),
    //   startHeight,
    // );

    // for (const event of etherLockups) {
    //   this.emit(
    //     'eth.lockup',
    //     event.transactionHash,
    //     formatEtherSwapValues(event.args!),
    //   );
    // }

    // etherClaims.forEach((event) => {
    //   this.emit('eth.claim', event.transactionHash, parseBuffer(event.topics[1]), parseBuffer(event.args!.preimage));
    // });

    // etherRefunds.forEach((event) => {
    //   this.emit('eth.refund', event.transactionHash, parseBuffer(event.topics[1]));
    // });

    // const erc20Lockups = await this.erc20Swap.queryFilter(
    //   this.erc20Swap.filters.Lockup(null, null, null, null, null, null),
    //   startHeight,
    // );

    // const erc20Claims = await this.erc20Swap.queryFilter(
    //   this.erc20Swap.filters.Claim(null, null),
    //   startHeight,
    // );

    // const erc20Refunds = await this.erc20Swap.queryFilter(
    //   this.erc20Swap.filters.Refund(null),
    //   startHeight,
    // );

    // for (const event of erc20Lockups) {
    //   this.emit(
    //     'erc20.lockup',
    //     event.transactionHash,
    //     formatERC20SwapValues(event.args!),
    //   );
    // }

    // erc20Claims.forEach((event) => {
    //   this.emit('erc20.claim', event.transactionHash, parseBuffer(event.topics[1]), parseBuffer(event.args!.preimage));
    // });

    // erc20Refunds.forEach((event) => {
    //   this.emit('erc20.refund', event.transactionHash, parseBuffer(event.topics[1]));
    // });
  }

  private subscribeContractEvents = async (contract:string) => {

    const client = await connectWebSocketClient(getStacksNetwork().wsUrl);
    console.log('stacks contracteventhandler.134 started listening to txns for ', contract, this.contractAddress, getStacksNetwork().wsUrl);
    // await client.subscribeAddressTransactions(contract, event => {
    //   console.log("stacks contracteventhandler.142 got event ", stringify(event));
    // });

    // this works so microblocks are ok
    // await client.subscribeMicroblocks(event => {
    //   console.log('ceh.207 got microblocks: ', event);
    // });

    // also not fired on microblocks - only on anchor blocks
    // socket.onAny((eventName, ...args) => {
    //   console.log('socket.io client got data: ', eventName, args);
    // });
    // sc.subscribeAddressTransactions('ST1N28QCRR03EW37S470PND4SPECCXQ22ZZHF97GP');
    // sc.subscribeAddressTransactions('ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF');
    
    // try to get txns in microblocks with websocket client
    // await client.subscribeAddressTransactions('ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF', event => {
    //   console.log('got event for ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF ', event);
    // });
    // await client.subscribeAddressTransactions('ST1N28QCRR03EW37S470PND4SPECCXQ22ZZHF97GP', event => {
    //   console.log('got event for ST1N28QCRR03EW37S470PND4SPECCXQ22ZZHF97GP ', event);
    // });

    // this.contractAddress -> was working but wrong!
    await client.subscribeAddressTransactions(contract, event => {
      //works!! but does not receive microblock events!
      console.log('stacks contracteventhandler.146 got event ', stringify(event));

      // failed call
      // {"address":"STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v2",
      // "tx_id":"0x83296167bca3fe4e18b236c708c09066c00adabd49c2ef2b27702d1d57c6035e",
      // "tx_status":"abort_by_response","tx_type":"contract_call"}

      // successful lockstx
      // {"address":"STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v2",
      // "tx_id":"0x4bfab6d417207532cbbe3b9c5957d2f77b9b02188e90f01b4c6483db7be95f04",
      // "tx_status":"success","tx_type":"contract_call"}

      // check for events:
      // http://localhost:3999/extended/v1/contract/STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3/events?offset=0&limit=2
      // http://localhost:3999/extended/v1/tx/0xfbe0acfbfe7e85b3e35b8a8b5edf3e041393b39f93b8c33aa5b0b005d9c0cdc4 // this is better!

      if(event.tx_status == 'success') {
        console.log('found a successful Tx on the contract, check it: ', event.tx_id);
        this.checkTx(event.tx_id);
      }
    });

    // this.etherSwap.on('Lockup', async (
    //   preimageHash: string,
    //   amount: BigNumber,
    //   claimAddress: string,
    //   refundAddress: string,
    //   timelock: BigNumber,
    //   event: Event,
    // ) => {
    //   this.emit(
    //     'eth.lockup',
    //     event.transactionHash,
    //     {
    //       amount,
    //       claimAddress,
    //       refundAddress,
    //       preimageHash: parseBuffer(preimageHash),
    //       timelock: timelock.toNumber(),
    //     },
    //   );
    // });

    // this.etherSwap.on('Claim', (preimageHash: string, preimage: string, event: Event) => {
    //   this.emit('eth.claim', event.transactionHash, parseBuffer(preimageHash), parseBuffer(preimage));
    // });

    // this.etherSwap.on('Refund', (preimageHash: string, event: Event) => {
    //   this.emit('eth.refund', event.transactionHash, parseBuffer(preimageHash));
    // });

    // this.erc20Swap.on('Lockup', async (
    //   preimageHash: string,
    //   amount: BigNumber,
    //   tokenAddress: string,
    //   claimAddress: string,
    //   refundAddress: string,
    //   timelock: BigNumber,
    //   event: Event,
    // ) => {
    //   this.emit(
    //     'erc20.lockup',
    //     event.transactionHash,
    //     {
    //       amount,
    //       tokenAddress,
    //       claimAddress,
    //       refundAddress,
    //       preimageHash: parseBuffer(preimageHash),
    //       timelock: timelock.toNumber(),
    //     },
    //   );
    // });

    // this.erc20Swap.on('Claim', (preimageHash: string, preimage: string, event: Event) => {
    //   this.emit('erc20.claim', event.transactionHash, parseBuffer(preimageHash), parseBuffer(preimage));
    // });

    // this.erc20Swap.on('Refund', (preimageHash: string, event: Event) => {
    //   this.emit('erc20.refund', event.transactionHash, parseBuffer(preimageHash));
    // });
  }

  private checkTx = async (txid:string) => {
    let lockFound = false;
    let claimFound = false;
    let refundFound = false;
    let txamount = 0;
    let hashvalue = '';
    const txData = await getTx(txid);
    txData.events.forEach(element => {
      // console.log("txData element: ", JSON.stringify(element));
        if(element.contract_log && element.contract_log.value.repr.includes('lock')){
          console.log('found LOCK!');
          lockFound = true;
        }
        if(element.contract_log && element.contract_log.value.repr.includes('claim')){
          console.log('found CLAIM!');
          claimFound = true;
        }
        if(element.contract_log && element.contract_log.value.repr.includes('refund')){
          console.log('found REFUND!');
          refundFound = true;
        }
        if(element.contract_log
          && !element.contract_log.value.repr.includes('lock')
          && !element.contract_log.value.repr.includes('claim')
          && !element.contract_log.value.repr.includes('refund')){
          console.log('found HASH! ', element.contract_log.value.repr);
          // this is not preimagehash for some reason?!
          // hashvalue = element.contract_log.value.repr;
        }
        if(element.event_type=='stx_asset' && element.asset.asset_event_type=='transfer') {
          txamount = element.asset.amount;
          console.log('stx transfer amount is ', element.asset.amount, txamount);
        }
    });

    if(!txData.contract_call.function_args) {
      console.log('contracteventhandler.328 no txData.contract_call.function_args - returning');
      return;
    }
    console.log('contracteventhandler.259 txData.contract_call.function_args: ', txData.contract_call.function_args);
    if(lockFound){
      // get data from contract call
      const preimageHash = txData.contract_call.function_args.filter(a=>a.name=='preimageHash')[0].repr;
      const amount = txData.contract_call.function_args.filter(a=>a.name=='amount')[0].repr;
      const claimAddress = txData.contract_call.function_args.filter(a=>a.name=='claimAddress')[0].repr;
      const refundAddress = txData.contract_call.function_args.filter(a=>a.name=='refundAddress')[0].repr;
      const timelock = txData.contract_call.function_args.filter(a=>a.name=='timelock')[0].repr;
      console.log('checkTx lockFound fetched from contract call: ', preimageHash,amount,claimAddress,refundAddress,timelock);

      // got all the data now check if we have the swap
      this.emit(
        'eth.lockup',
        txid,
        {
          amount,
          claimAddress,
          refundAddress,
          preimageHash: parseBuffer(preimageHash),
          timelock: timelock,
        },
      );
    }

    if(claimFound) {
      // get data from contract call
      const preimage = txData.contract_call.function_args.filter(a=>a.name=='preimage')[0].repr;
      const amount = txData.contract_call.function_args.filter(a=>a.name=='amount')[0].repr;
      const claimAddress = txData.contract_call.function_args.filter(a=>a.name=='claimAddress')[0].repr;
      const refundAddress = txData.contract_call.function_args.filter(a=>a.name=='refundAddress')[0].repr;
      const timelock = txData.contract_call.function_args.filter(a=>a.name=='timelock')[0].repr;
      hashvalue = getHexString(crypto.sha256(getHexBuffer(preimage.slice(2))));
      // this is correct now
      console.log('claimFound fetched from contract call: ', preimage,hashvalue,amount,claimAddress,refundAddress,timelock);
      // let preimageHash = txData.contract_call.function_args.filter(a=>a.name=="preimageHash")[0].repr

      // got all the data now check if we have the swap
      // getHexBuffer -> good, parseBuffer -> butcher .slice(2)
      this.emit('eth.claim', txid,  getHexBuffer(hashvalue), parseBuffer(preimage));
    }

    if(refundFound) {
      // get data from contract call
      const preimageHash = txData.contract_call.function_args.filter(a=>a.name=='preimageHash')[0].repr;
      const amount = txData.contract_call.function_args.filter(a=>a.name=='amount')[0].repr;
      const claimAddress = txData.contract_call.function_args.filter(a=>a.name=='claimAddress')[0].repr;
      const refundAddress = txData.contract_call.function_args.filter(a=>a.name=='refundAddress')[0].repr;
      const timelock = txData.contract_call.function_args.filter(a=>a.name=='timelock')[0].repr;
      console.log('refundFound fetched from contract call: ', preimageHash,amount,claimAddress,refundAddress,timelock);
      // let preimageHash = txData.contract_call.function_args.filter(a=>a.name=="preimageHash")[0].repr

      // got all the data now check if we have the swap
      this.emit('eth.refund', txid, parseBuffer(preimageHash));
    }

  }

  // SIP10 Events
  private subscribeTokenContractEvents = async (contract:string) => {

    const client = await connectWebSocketClient(getStacksNetwork().wsUrl);
    console.log('stacks contracteventhandler.382 started listening to sip10 txns for ', contract, this.contractAddress, getStacksNetwork().wsUrl);
    // await client.subscribeAddressTransactions(contract, event => {
    //   console.log("stacks contracteventhandler.142 got event ", stringify(event));
    // });

    // this.contractAddress -> was working but wrong!
    await client.subscribeAddressTransactions(contract, event => {
      //works!!
      console.log('stacks contracteventhandler.390 got event ', stringify(event));

      // failed call
      // {"address":"STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v2",
      // "tx_id":"0x83296167bca3fe4e18b236c708c09066c00adabd49c2ef2b27702d1d57c6035e",
      // "tx_status":"abort_by_response","tx_type":"contract_call"}

      // successful lockstx
      // {"address":"STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v2",
      // "tx_id":"0x4bfab6d417207532cbbe3b9c5957d2f77b9b02188e90f01b4c6483db7be95f04",
      // "tx_status":"success","tx_type":"contract_call"}

      // check for events:
      // http://localhost:3999/extended/v1/contract/STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3/events?offset=0&limit=2
      // http://localhost:3999/extended/v1/tx/0xfbe0acfbfe7e85b3e35b8a8b5edf3e041393b39f93b8c33aa5b0b005d9c0cdc4 // this is better!

      if(event.tx_status == 'success') {
        console.log('found a successful Tx on the contract, check it: ', event.tx_id);
        this.checkTokenTx(event.tx_id);
      }
    });

    // this.etherSwap.on('Lockup', async (
    //   preimageHash: string,
    //   amount: BigNumber,
    //   claimAddress: string,
    //   refundAddress: string,
    //   timelock: BigNumber,
    //   event: Event,
    // ) => {
    //   this.emit(
    //     'eth.lockup',
    //     event.transactionHash,
    //     {
    //       amount,
    //       claimAddress,
    //       refundAddress,
    //       preimageHash: parseBuffer(preimageHash),
    //       timelock: timelock.toNumber(),
    //     },
    //   );
    // });

    // this.etherSwap.on('Claim', (preimageHash: string, preimage: string, event: Event) => {
    //   this.emit('eth.claim', event.transactionHash, parseBuffer(preimageHash), parseBuffer(preimage));
    // });

    // this.etherSwap.on('Refund', (preimageHash: string, event: Event) => {
    //   this.emit('eth.refund', event.transactionHash, parseBuffer(preimageHash));
    // });

    // this.erc20Swap.on('Lockup', async (
    //   preimageHash: string,
    //   amount: BigNumber,
    //   tokenAddress: string,
    //   claimAddress: string,
    //   refundAddress: string,
    //   timelock: BigNumber,
    //   event: Event,
    // ) => {
    //   this.emit(
    //     'erc20.lockup',
    //     event.transactionHash,
    //     {
    //       amount,
    //       tokenAddress,
    //       claimAddress,
    //       refundAddress,
    //       preimageHash: parseBuffer(preimageHash),
    //       timelock: timelock.toNumber(),
    //     },
    //   );
    // });

    // this.erc20Swap.on('Claim', (preimageHash: string, preimage: string, event: Event) => {
    //   this.emit('erc20.claim', event.transactionHash, parseBuffer(preimageHash), parseBuffer(preimage));
    // });

    // this.erc20Swap.on('Refund', (preimageHash: string, event: Event) => {
    //   this.emit('erc20.refund', event.transactionHash, parseBuffer(preimageHash));
    // });
  }

  private checkTokenTx = async (txid:string) => {
    let lockFound = false;
    let claimFound = false;
    let refundFound = false;
    let txamount = 0;
    let hashvalue = '';
    const txData = await getTx(txid);
    txData.events.forEach(element => {
      // console.log("checkTokenTx txData element: ", JSON.stringify(element));
        if(element.contract_log && element.contract_log.value.repr.includes('lock')){
          console.log('found LOCK!');
          lockFound = true;
        }
        if(element.contract_log && element.contract_log.value.repr.includes('claim')){
          console.log('found CLAIM!');
          claimFound = true;
        }
        if(element.contract_log && element.contract_log.value.repr.includes('refund')){
          console.log('found REFUND!');
          refundFound = true;
        }
        // if(element.contract_log
        //   && !element.contract_log.value.repr.includes("lock")
        //   && !element.contract_log.value.repr.includes("claim")
        //   && !element.contract_log.value.repr.includes("refund")){
        //   console.log("found HASH! ", element.contract_log.value.repr);
        //   // this is not preimagehash for some reason?!
        //   // hashvalue = element.contract_log.value.repr;
        // }

        // if(element.event_type=="stx_asset" && element.asset.asset_event_type=="transfer") {
        //   txamount = element.asset.amount
        //   console.log("stx transfer amount is ", element.asset.amount, txamount);
        // }
        if(element.event_type=='fungible_token_asset' && element.asset.asset_event_type=='transfer') {
          txamount = element.asset.amount;
          console.log('sip10 token transfer amount is ', element.asset.amount, txamount);
        }
    });

    console.log('contracteventhandler.508 txData.contract_call.function_args: ', txData.contract_call.function_args);
    if(lockFound){
      // get data from contract call
      const preimageHash = txData.contract_call.function_args.filter(a=>a.name=='preimageHash')[0].repr;
      const amount = txData.contract_call.function_args.filter(a=>a.name=='amount')[0].repr;
      const claimAddress = txData.contract_call.function_args.filter(a=>a.name=='claimAddress')[0].repr;
      const tokenAddress = txData.contract_call.function_args.filter(a=>a.name=='tokenAddress')[0].repr;
      const timelock = txData.contract_call.function_args.filter(a=>a.name=='timelock')[0].repr;
      const tokenPrincipal = txData.contract_call.function_args.filter(a=>a.name=='tokenPrincipal')[0].repr;
      const claimPrincipal = txData.contract_call.function_args.filter(a=>a.name=='claimPrincipal')[0].repr;
      console.log('checkTokenTx lockFound fetched from contract call: ', preimageHash,amount,claimAddress,tokenAddress,timelock);

      // got all the data now check if we have the swap
      this.emit(
        // 'eth.lockup',
        'sip10.lockup',
        txid,
        {
          amount,
          tokenAddress,
          claimAddress, //dummy
          refundAddress: claimAddress,  //dummy
          preimageHash: parseBuffer(preimageHash),
          timelock: timelock,
        },
        claimPrincipal,
        tokenPrincipal,
      );
    }

    if(claimFound) {
      // get data from contract call
      const preimage = txData.contract_call.function_args.filter(a=>a.name=='preimage')[0].repr;
      const amount = txData.contract_call.function_args.filter(a=>a.name=='amount')[0].repr;
      const claimAddress = txData.contract_call.function_args.filter(a=>a.name=='claimAddress')[0].repr;
      const refundAddress = txData.contract_call.function_args.filter(a=>a.name=='refundAddress')[0].repr;
      const timelock = txData.contract_call.function_args.filter(a=>a.name=='timelock')[0].repr;
      hashvalue = getHexString(crypto.sha256(getHexBuffer(preimage.slice(2))));
      // this is correct now
      console.log('claimFound fetched from contract call: ', preimage,hashvalue,amount,claimAddress,refundAddress,timelock);
      // let preimageHash = txData.contract_call.function_args.filter(a=>a.name=="preimageHash")[0].repr

      // got all the data now check if we have the swap
      // getHexBuffer -> good, parseBuffer -> butcher .slice(2)
      this.emit('eth.claim', txid,  getHexBuffer(hashvalue), parseBuffer(preimage));
    }

    if(refundFound) {
      // get data from contract call
      const preimageHash = txData.contract_call.function_args.filter(a=>a.name=='preimageHash')[0].repr;
      const amount = txData.contract_call.function_args.filter(a=>a.name=='amount')[0].repr;
      const claimAddress = txData.contract_call.function_args.filter(a=>a.name=='claimAddress')[0].repr;
      const refundAddress = txData.contract_call.function_args.filter(a=>a.name=='refundAddress')[0].repr;
      const timelock = txData.contract_call.function_args.filter(a=>a.name=='timelock')[0].repr;
      console.log('refundFound fetched from contract call: ', preimageHash,amount,claimAddress,refundAddress,timelock);
      // let preimageHash = txData.contract_call.function_args.filter(a=>a.name=="preimageHash")[0].repr

      // got all the data now check if we have the swap
      this.emit('eth.refund', txid, parseBuffer(preimageHash));
    }

  }

}

export default ContractEventHandler;

// txData
// {
//   "tx_id": "0xfbe0acfbfe7e85b3e35b8a8b5edf3e041393b39f93b8c33aa5b0b005d9c0cdc4",
//   "nonce": 5,
//   "fee_rate": "283",
//   "sender_address": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3",
//   "sponsored": false,
//   "post_condition_mode": "deny",
//   "post_conditions": [
//       {
//           "type": "stx",
//           "condition_code": "sent_less_than_or_equal_to",
//           "amount": "2000000",
//           "principal": {
//               "type_id": "principal_standard",
//               "address": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3"
//           }
//       }
//   ],
//   "anchor_mode": "any",
//   "is_unanchored": false,
//   "block_hash": "0x33cb383e78a7ce02a8f3e18a1bdba92905f3a579e4322a55c897d1500f5f2c7e",
//   "parent_block_hash": "0xba022893dc7e1af8f50b8d869a9baff1e70a46584dff3d2e055ce1f480cd80fb",
//   "block_height": 1853,
//   "burn_block_time": 1629260412,
//   "burn_block_time_iso": "2021-08-18T04:20:12.000Z",
//   "parent_burn_block_time": 1629260402,
//   "parent_burn_block_time_iso": "2021-08-18T04:20:02.000Z",
//   "canonical": true,
//   "tx_index": 1,
//   "tx_status": "success",
//   "tx_result": {
//       "hex": "0x0703",
//       "repr": "(ok true)"
//   },
//   "microblock_hash": "",
//   "microblock_sequence": 2147483647,
//   "microblock_canonical": true,
//   "event_count": 3,
//   "events": [
//       {
//           "event_index": 0,
//           "event_type": "stx_asset",
//           "asset": {
//               "asset_event_type": "transfer",
//               "sender": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3",
//               "recipient": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3",
//               "amount": "1048576"
//           }
//       },
//       {
//           "event_index": 1,
//           "event_type": "smart_contract_log",
//           "contract_log": {
//               "contract_id": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3",
//               "topic": "print",
//               "value": {
//                   "hex": "0x0d000000046c6f636b",
//                   "repr": "\"lock\""
//               }
//           }
//       },
//       {
//           "event_index": 2,
//           "event_type": "smart_contract_log",
//           "contract_log": {
//               "contract_id": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3",
//               "topic": "print",
//               "value": {
//                   "hex": "0x0200000020648ef8cb3bb2d988afd266b9e0bbc27c217b3de5d63109da751fdc356e033b99",
//                   "repr": "0x648ef8cb3bb2d988afd266b9e0bbc27c217b3de5d63109da751fdc356e033b99"
//               }
//           }
//       }
//   ],
//   "tx_type": "contract_call",
//   "contract_call": {
//       "contract_id": "STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3",
//       "function_name": "lockStx",
//       "function_signature": "(define-public (lockStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16))))",
//       "function_args": [
//           {
//               "hex": "0x02000000204bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a",
//               "repr": "0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a",
//               "name": "preimageHash",
//               "type": "(buff 32)"
//           },
//           {
//               "hex": "0x020000001000000000000000000000000000100000",
//               "repr": "0x00000000000000000000000000100000",
//               "name": "amount",
//               "type": "(buff 16)"
//           },
//           {
//               "hex": "0x020000000101",
//               "repr": "0x01",
//               "name": "claimAddress",
//               "type": "(buff 42)"
//           },
//           {
//               "hex": "0x020000000101",
//               "repr": "0x01",
//               "name": "refundAddress",
//               "type": "(buff 42)"
//           },
//           {
//               "hex": "0x0200000010000000000000000000000000000012b3",
//               "repr": "0x000000000000000000000000000012b3",
//               "name": "timelock",
//               "type": "(buff 16)"
//           }
//       ]
//   }
// }