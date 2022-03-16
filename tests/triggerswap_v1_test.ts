import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
// import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that user can lock and trigger stx transfer to another address",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
      const wallet_3 = accounts.get("wallet_3")!;
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
      // console.log(`lock.30 `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          "triggerswap",
          "triggerTransferStx",
          [
            `0x01`, //preimage
            types.uint(amount),
            types.principal(wallet_3.address),
            types.ascii("Buy: 4167 Code: 7e28eac65f")
          ],
          wallet_2.address
        ),
      ]);
      // console.log(`triggerTransferStx.49 `, block, block.receipts[0].events);
      block.receipts[0].result.expectOk().expectBool(true);
    },
  });
