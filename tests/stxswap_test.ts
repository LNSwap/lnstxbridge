/* eslint-disable import/no-unresolved */
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = 'stxswap';

  Clarinet.test({
    name: 'Ensure that user can lock and claim stx',
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      const wallet_2 = accounts.get('wallet_2')!;
      const amount = 1000;
      let block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock.83 `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'claimStx',
          [
            '0x01', //preimage
            types.uint(amount),
          ],
          wallet_2.address
        ),
      ]);
      // console.log(`claim.101 `, block, block.receipts[0].events);
      block.receipts[0].result.expectOk().expectUint(1008);
    },
  });

  Clarinet.test({
    name: 'Ensure that user can lock and refund stx',
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      const wallet_2 = accounts.get('wallet_2')!;
      const amount = 1_000;
      let block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock ok `, block, block.receipts[0].events);

      // check the swap before refund
      const swap = chain.callReadOnlyFn(
        contractName,
        'getSwap',
        [
          '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a'
        ],
        wallet_1.address
      );
      assertEquals(swap.result, '(some {amount: u1000, claimPrincipal: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, initiator: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, timelock: u5})');

      chain.mineEmptyBlockUntil(6);
      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'refundStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);

    },
  });

  Clarinet.test({
    name: "Ensure user can't claim funds that is locked for someone else",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      const wallet_2 = accounts.get('wallet_2')!;
      const amount = 1000;
      let block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock.83 `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'claimStx',
          [
            '0x01', //preimage
            types.uint(amount),
          ],
          wallet_1.address
        ),
      ]);
      // console.log(`claim.101 `, block, block.receipts[0].events);
      block.receipts[0].result.expectErr().expectUint(1002);
    },
  });

  Clarinet.test({
    name: "Ensure that user can't claim funds for non-existent swap",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      const wallet_2 = accounts.get('wallet_2')!;
      const amount = 1000;
      let block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock.83 `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'claimStx',
          [
            '0x02', // wrong preimage
            types.uint(amount),
          ],
          wallet_2.address
        ),
      ]);
      // console.log(`claim.101 `, block, block.receipts[0].events);
      block.receipts[0].result.expectErr().expectUint(1000);
    },
  });

  Clarinet.test({
    name: "Ensure that user can't lock with same hash twice",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      const wallet_2 = accounts.get('wallet_2')!;
      const amount = 1000;
      let block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock.83 `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount+10),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectErr().expectUint(1005);

    },
  });

  //
  Clarinet.test({
    name: "Ensure that user can't refund non-existent hash",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      // const wallet_2 = accounts.get('wallet_2')!;

      // chain.mineEmptyBlockUntil(6);
      const block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'refundStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectErr().expectUint(1000);

    },
  });

  Clarinet.test({
    name: "Ensure that user can't claim after refund - confirm hash is deleted from swaps map",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get('wallet_1')!;
      const wallet_2 = accounts.get('wallet_2')!;
      const amount = 1_000;
      let block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'lockStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock ok `, block, block.receipts[0].events);

      // check the swap before refund
      const swap = chain.callReadOnlyFn(
        contractName,
        'getSwap',
        [
          '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a'
        ],
        wallet_1.address
      );
      assertEquals(swap.result, '(some {amount: u1000, claimPrincipal: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG, initiator: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, timelock: u5})');

      chain.mineEmptyBlockUntil(6);
      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'refundStx',
          [
            '0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', // preimagehash
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);

      block = chain.mineBlock([
        Tx.contractCall(
          contractName,
          'claimStx',
          [
            '0x01', // preimage
            types.uint(amount),
          ],
          wallet_2.address
        ),
      ]);
      // console.log(`claim.101 `, block, block.receipts[0].events);
      block.receipts[0].result.expectErr().expectUint(1000);

    },
  });