/* eslint-disable import/no-unresolved */
import { join } from 'path';
import { ContractABIs } from 'boltz-core';
import { existsSync, readFileSync } from 'fs';
import { ERC20 } from 'boltz-core/typechain/ERC20';
import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
import { Signer, providers, Wallet, Contract } from 'ethers';

const Constants = {
  erc20TokenAddress: '0x9f84F92d952f90027618089F6F2a3481f1a3fa0F',
  rbtcSwapAddress: '0x4efc8b4323e532db6cd78d70a97f83bc7559cef3',
  erc20SwapAddress: '0x3b15af794d4e39589a31089ce0b53a9e1994930f',
  stxSwapAddress: 'STR187KT73T0A8M0DEWDX06TJR2B8WM0WP9VGZY3.stxswap_v3'
};

const connectEthereum = (providerUrl: string, signerAddress: string): Signer => {
  const provider = new providers.JsonRpcProvider(providerUrl);
  console.log('rsk connectEthereum signerAddress: ', signerAddress);
  return provider.getSigner(signerAddress);
};

const getContracts = (signer: Signer): { token: ERC20, etherSwap: EtherSwap, erc20Swap: ERC20Swap } => {
  return {
    token: new Contract(
      Constants.erc20TokenAddress,
      ContractABIs.ERC20,
      signer,
    ) as any as ERC20,

    etherSwap: new Contract(
      Constants.rbtcSwapAddress,
      ContractABIs.EtherSwap,
      signer,
    ) as any as EtherSwap,
    erc20Swap: new Contract(
      Constants.erc20SwapAddress,
      ContractABIs.ERC20Swap,
      signer,
    ) as any as ERC20Swap,
  };
};

const getBoltzAddress = async (): Promise<string | undefined> => {
  const filePath = join(process.env.HOME!, '.boltz/seed.dat');

  if (existsSync(filePath)) {
    return Wallet.fromMnemonic(readFileSync(
      filePath,
      {
        encoding: 'utf-8',
      },
    )).getAddress();
  }

  return;
};

export {
  Constants,
  getContracts,
  connectEthereum,
  getBoltzAddress,
};
