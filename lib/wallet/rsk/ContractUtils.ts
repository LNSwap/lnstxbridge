/* eslint-disable import/no-unresolved */
import { EtherSwap } from 'boltz-core/typechain/EtherSwap';
import { ERC20Swap } from 'boltz-core/typechain/ERC20Swap';
import Errors from './Errors';
import { utils } from 'ethers';
import { parseBuffer } from './EthereumUtils';
import { ERC20SwapValues, EtherSwapValues } from '../../consts/Types';

// TODO: what happens if the hash doesn't exist or the transaction isn't confirmed yet?

export const queryEtherSwapValuesFromLock = async (etherSwap: EtherSwap, lockTransactionHash: string): Promise<EtherSwapValues> => {
  console.log('rsk ContractUtils queryEtherSwapValuesFromLock start lockTransactionHash: ', lockTransactionHash);
  const lockTransactionReceipt = await etherSwap.provider.getTransactionReceipt(lockTransactionHash);

  const topicHash = etherSwap.filters.Lockup(null, null, null, null, null).topics![0];

  console.log('rsk ContractUtils queryEtherSwapValuesFromLock start logs');
  for (const log of lockTransactionReceipt.logs) {
    if (log.topics[0] === topicHash) {
      const event = etherSwap.interface.parseLog(log);
      return formatEtherSwapValues(event.args);
    }
  }

  throw Errors.INVALID_LOCKUP_TRANSACTION(lockTransactionHash);
};

export const queryERC20SwapValuesFromLock = async (erc20Swap: ERC20Swap, lockTransactionHash: string): Promise<ERC20SwapValues> => {
  const lockTransactionReceipt = await erc20Swap.provider.getTransactionReceipt(lockTransactionHash);

  const topicHash = erc20Swap.filters.Lockup(null, null, null, null, null, null).topics![0];

  for (const log of lockTransactionReceipt.logs) {
    if (log.topics[0] === topicHash) {
      const event = erc20Swap.interface.parseLog(log);
      return formatERC20SwapValues(event.args);
    }
  }

  throw Errors.INVALID_LOCKUP_TRANSACTION(lockTransactionHash);
};

export const queryEtherSwapValues = async (etherSwap: EtherSwap, preimageHash: Buffer): Promise<EtherSwapValues> => {
  console.log('rsk ContractUtils queryEtherSwapValues start: ');
  const events = await etherSwap.queryFilter(
    etherSwap.filters.Lockup(preimageHash, null, null, null, null),
  );

  if (events.length === 0) {
    throw Errors.NO_LOCKUP_FOUND();
  }

  const event = events[0];

  console.log('rsk ContractUtils queryEtherSwapValues end: ');
  return formatEtherSwapValues(event.args!);
};

export const queryERC20SwapValues = async (erc20Swap: ERC20Swap, preimageHash: Buffer): Promise<ERC20SwapValues> => {
  console.log('queryERC20SwapValues for any lockups ' + JSON.stringify(erc20Swap));
  const events = await erc20Swap.queryFilter(
    erc20Swap.filters.Lockup(preimageHash, null, null, null, null, null),
  );

  if (events.length === 0) {
    throw Errors.NO_LOCKUP_FOUND();
  }

  const event = events[0];

  return formatERC20SwapValues(event.args!);
};

export const formatEtherSwapValues = (args: utils.Result): EtherSwapValues => {
  return {
    amount: args.amount,
    claimAddress: args.claimAddress,
    refundAddress: args.refundAddress,
    timelock: args.timelock.toNumber(),
    preimageHash: parseBuffer(args.preimageHash),
  };
};

export const formatERC20SwapValues = (args: utils.Result): ERC20SwapValues => {
  return {
    amount: args.amount,
    claimAddress: args.claimAddress,
    tokenAddress: args.tokenAddress,
    refundAddress: args.refundAddress,
    timelock: args.timelock.toNumber(),
    preimageHash: parseBuffer(args.preimageHash),
  };
};
