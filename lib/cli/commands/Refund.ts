import { Arguments } from 'yargs';
import { address, ECPair, Transaction, networks } from 'bitcoinjs-lib';
// Networks, 
import { constructRefundTransaction, detectSwap } from 'boltz-core';
import BuilderComponents from '../BuilderComponents';
import { getHexBuffer, stringify } from '../../Utils';

export const command = 'refund <network> <privateKey> <redeemScript> <rawTransaction> <destinationAddress>';

export const describe = 'refunds submarine or chain to chain swaps';

export const builder = {
  network: BuilderComponents.network, // bitcoinMainnet
  privateKey: BuilderComponents.privateKey,
  redeemScript: BuilderComponents.redeemScript,
  rawTransaction: BuilderComponents.rawTransaction,
  destinationAddress: BuilderComponents.destinationAddress,
};

export const handler = (argv: Arguments<any>): void => {
  // const network = Networks[argv.network];
  const network = networks.bitcoin;

  const redeemScript = getHexBuffer(argv.redeemScript);
  const transaction = Transaction.fromHex(argv.rawTransaction);
  const swapOutput = detectSwap(redeemScript, transaction)!;

  console.log('refund constructRefundTransaction ', 
    swapOutput, transaction.getHash(), 
    address.toOutputScript(argv.destinationAddress, 
    network));

  const refundTransaction = constructRefundTransaction(
    [{
      ...swapOutput,
      txHash: transaction.getHash(),
      redeemScript: getHexBuffer(argv.redeemScript),
      keys: ECPair.fromPrivateKey(getHexBuffer(argv.privateKey)),
    }],
    address.toOutputScript(argv.destinationAddress, network),
    717768, // timeoutblockheight!!!
    2,
    true,
  ).toHex();

  console.log(stringify({ refundTransaction }));
};
