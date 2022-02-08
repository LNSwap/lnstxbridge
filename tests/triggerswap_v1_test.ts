import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that user can lock and trigger stx transfer to another address",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
      const wallet_3 = accounts.get("wallet_3")!;
      const amount = 1_000;
    //   console.log(`amount `, `0x${amount.toString(16).padStart(16, "0")}`);
      let block = chain.mineBlock([
        Tx.contractCall(
          "stxswap",
          "lockStx",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
            `0x${amount.toString(16).padStart(32, "0")}`, // amount
            `0x${"5678".padStart(42, "0")}`, // claimaddress
            `0x${"9abc".padStart(42, "0")}`, // refundaddress
            `0x${"5".padStart(32, "0")}`, // timelock
            types.principal(wallet_2.address),
          ],
          wallet_1.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectBool(true);
    //   console.log(`lock ok `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          "triggerswap",
          "triggerTransferStx",
          [
            `0x01`, //preimage
            `0x${amount.toString(16).padStart(32, "0")}`, // amount
            `0x${"5678".padStart(42, "0")}`, // claimaddress
            `0x${"9abc".padStart(42, "0")}`, // refundaddress
            `0x${"5".padStart(32, "0")}`, // timelock
            types.principal(wallet_3.address),
          ],
          wallet_2.address
        ),
      ]);
      console.log(block, block.receipts[0].events);
      block.receipts[0].result.expectOk().expectBool(true);
    },
  });
