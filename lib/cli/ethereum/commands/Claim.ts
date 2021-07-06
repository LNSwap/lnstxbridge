import { Arguments } from 'yargs';
import { crypto } from 'bitcoinjs-lib';
import { ContractTransaction } from 'ethers';
import { getHexBuffer, getHexString } from '../../../Utils';
import BuilderComponents from '../../BuilderComponents';
import { connectEthereum, getContracts } from '../EthereumUtils';
import { queryERC20SwapValues, queryEtherSwapValues } from '../../../wallet/ethereum/ContractUtils';

export const command = 'claim <preimage> [token]';

export const describe = 'claims Ether or a ERC20 token from the corresponding swap contract';

export const builder = {
  preimage: {
    describe: 'preimage with which the funds have been locked',
    type: 'string',
  },
  token: BuilderComponents.token,
};

export const handler = async (argv: Arguments<any>): Promise<void> => {
  const signer = connectEthereum(argv.provider, argv.signer);
  const { etherSwap, erc20Swap } = getContracts(signer);

  const preimage = getHexBuffer(argv.preimage);

  let transaction: ContractTransaction;

  if (argv.token) {
    console.log("eth claim: ", preimage, "\n", getHexString(preimage), "\n", crypto.sha256(preimage), "\nercswap::" ,JSON.stringify(erc20Swap));
    // const erc20SwapValues = await queryERC20SwapValues(erc20Swap, crypto.sha256(preimage)); -> original code, didnt work!!!
    const erc20SwapValues = await queryERC20SwapValues(erc20Swap, preimage); // worked!!!
    // eth erc20SwapValues:  
    // {"amount":{"type":"BigNumber","hex":"0x01acb4add64eef8000"},
    // "claimAddress":"0x455fCf9Af2938F8f1603182bFBC867af1731d450",
    // "tokenAddress":"0x23d5395De7862A174b0cCbf9f7A350b4b8afC720",
    // "refundAddress":"0xE142868123AB36a88F86A8f5Cd08A77E9225dA60",
    // "timelock":758,
    // "preimageHash":{"type":"Buffer","data":[53,194,108,143,113,144,237,158,142,56,132,54,148,251,222,228,39,228,191,200,101,145,86,156,225,134,15,202,167,77,179,131]}}

    // 35c26c8f7190ed9e8e38843694fbdee427e4bfc86591569ce1860fcaa74db383, 
    // 30891506880000000000, 
    // 0x455fCf9Af2938F8f1603182bFBC867af1731d450, 
    // 758

    console.log("eth erc20SwapValues: ", JSON.stringify(erc20SwapValues));
    // return;
    transaction = await erc20Swap.claim(
      preimage,
      // crypto.sha256(preimage),
      // erc20SwapValues.preimageHash,
      erc20SwapValues.amount,
      // 3089150688,
      // 0xB820B2E0,
      // 0x01acb4add64eef8000,
      erc20SwapValues.tokenAddress,
      erc20SwapValues.refundAddress,
      // "0xe142868123ab36a88f86a8f5cd08a77e9225da60",
      erc20SwapValues.timelock,
      // "0x2F6"
      // 758
    );

    // manual claim
    // transaction = await erc20Swap.claim(
    //   preimage,
    //   3113946464,
    //   '0x23d5395De7862A174b0cCbf9f7A350b4b8afC720',
    //   "0xE142868123AB36a88F86A8f5Cd08A77E9225dA60",
    //   0x2F2,
    // );
  } else {
    const etherSwapValues = await queryEtherSwapValues(etherSwap, crypto.sha256(preimage));
    transaction = await etherSwap.claim(
      preimage,
      etherSwapValues.amount,
      etherSwapValues.refundAddress,
      etherSwapValues.timelock,
    );
  }

  await transaction.wait(1);

  console.log(`Claimed ${argv.token ? 'ERC20 token' : 'Ether'} in: ${transaction.hash}`);
};
