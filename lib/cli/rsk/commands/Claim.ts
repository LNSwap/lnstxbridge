import { Arguments } from 'yargs';
import { crypto } from 'bitcoinjs-lib';
import { ContractTransaction } from 'ethers';
import { getHexBuffer } from '../../../Utils';
import BuilderComponents from '../../BuilderComponents';
import { connectEthereum, getContracts } from '../EthereumUtils';
import { queryERC20SwapValues, queryEtherSwapValues } from '../../../wallet/rsk/ContractUtils';

export const command = 'claim <preimage> [token]';

export const describe = 'claims Rbtc or a ERC20 token from the corresponding swap contract';

export const builder = {
  preimage: {
    describe: 'preimage with which the funds have been locked',
    type: 'string',
  },
  token: BuilderComponents.token,
};

export const handler = async (argv: Arguments<any>): Promise<void> => {
  console.log("rsk claim: ", argv.provider, argv.signer);
  const signer = connectEthereum(argv.provider, argv.signer);
  const { etherSwap, erc20Swap } = getContracts(signer);

  const preimage = getHexBuffer(argv.preimage);

  let transaction: ContractTransaction;

  if (argv.token) {
    console.log("1rerc20 claim erc20SwapValues: ", argv.token, JSON.stringify(erc20Swap));

    // // const erc20SwapValues = await queryERC20SwapValues(erc20Swap, crypto.sha256(preimage));
    // const erc20SwapValues = await queryERC20SwapValues(erc20Swap, preimage);
    // console.log("rerc20 claim erc20SwapValues: ", JSON.stringify(erc20SwapValues));
    // transaction = await erc20Swap.claim(
    //   preimage,
    //   erc20SwapValues.amount,
    //   erc20SwapValues.tokenAddress,
    //   erc20SwapValues.refundAddress,
    //   erc20SwapValues.timelock,
    // );

    // manual claim
    transaction = await erc20Swap.claim(
      preimage,
      112279872,
      "0x9f84F92d952f90027618089F6F2a3481f1a3fa0F",
      "0xe142868123ab36a88f86a8f5cd08a77e9225da60",
      297071,
    );
  } else {
    console.log("rbtc claim to refundaddress: ", JSON.stringify(etherSwap));
    const etherSwapValues = await queryEtherSwapValues(etherSwap, crypto.sha256(preimage));
    console.log("rbtc claim to refundaddress: ", etherSwapValues.refundAddress)
    transaction = await etherSwap.claim(
      preimage,
      etherSwapValues.amount,
      etherSwapValues.refundAddress,
      etherSwapValues.timelock,
    );
  }

  console.log("waiting some more ", transaction.hash, JSON.stringify(transaction));
  await transaction.wait(1);
  console.log("after waiting some more");
  console.log(`Claimed ${argv.token ? 'ERC20 token' : 'Rbtc'} in: ${transaction.hash}`);
};
