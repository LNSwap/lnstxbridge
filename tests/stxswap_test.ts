import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
// import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

  Clarinet.test({
    name: "Ensure that user can lock and claim stx",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
      const amount = 1000;
      let block = chain.mineBlock([
        Tx.contractCall(
          "stxswap",
          "lockStx",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
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
          "stxswap",
          "claimStx",
          [
            `0x01`, //preimage
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
    name: "Ensure that user can lock and refund stx",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
      const amount = 1_000;
      let block = chain.mineBlock([
        Tx.contractCall(
          "stxswap",
          "lockStx",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
            types.uint(amount),
            types.uint(5),
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
    //   console.log(`lock ok `, block, block.receipts[0].events);
      chain.mineEmptyBlockUntil(6);
      block = chain.mineBlock([
        Tx.contractCall(
          "stxswap",
          "refundStx",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
    },
  });

  // Ensure user can't claim funds that is locked for someone else
  
  // Ensure that user can't claim funds for non-existent swap

  // lock with same hash twice

  // refund non-existent hash

  // claim after refund - check if map is deleted