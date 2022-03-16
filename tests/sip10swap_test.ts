
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
// import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

  Clarinet.test({
    name: "Ensure that user can lock and claim sip9 or sip10 tokens",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const deployer = accounts.get("deployer")!;
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
    //   console.log(`wallet address: `, accounts);

      const assetMaps = chain.getAssetsMaps();
      const stxbalance = assetMaps.assets['STX'][deployer.address];
      const usdabalance = assetMaps.assets[".usda-token.usda"][deployer.address];
      // console.log(`assetMaps: `, assetMaps);
      // console.log(`deployer balances: `, stxbalance, usdabalance);

      const sip10contract = deployer.address + '.usda-token';

      const amount = 1_000;
    //   console.log(`amount `, `0x${amount.toString(16).padStart(16, "0")}`);
      let block = chain.mineBlock([
        Tx.contractCall(
          "sip10swap",
          "lockToken",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
            types.uint(amount),
            types.uint(5), // timelock
            types.principal(wallet_2.address), // claimPrincipal
            types.principal(sip10contract),
          ],
          deployer.address
        ),
      ]);
      // console.log(`block `, block);
      block.receipts[0].result.expectOk().expectUint(1008);
      // console.log(`lock ok `, block, block.receipts[0].events);

      block = chain.mineBlock([
        Tx.contractCall(
          "sip10swap",
          "claimToken",
          [
            `0x01`, //preimage
            types.uint(amount),
            types.principal(sip10contract),
          ],
          wallet_2.address
        ),
      ]);
    //   console.log(block);
      block.receipts[0].result.expectOk().expectUint(1008);
    },
  });

  Clarinet.test({
    name: "Ensure that user can lock and refund sip9 or sip10 tokens",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const deployer = accounts.get("deployer")!;
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
      let sip10contract = deployer.address + '.usda-token';
      const amount = 1_000;
      let block = chain.mineBlock([
        Tx.contractCall(
          "sip10swap",
          "lockToken",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
            types.uint(amount),
            types.uint(5), // timelock
            types.principal(wallet_2.address),
            types.principal(sip10contract),
          ],
          deployer.address
        ),
      ]);
      // console.log(`lockToken.92 `, block, block.receipts[0].events);
      block.receipts[0].result.expectOk().expectUint(1008);

      chain.mineEmptyBlockUntil(6);
      block = chain.mineBlock([
        Tx.contractCall(
          "sip10swap",
          "refundToken",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
            types.principal(sip10contract),
          ],
          deployer.address
        ),
      ]);
      block.receipts[0].result.expectOk().expectUint(1008);
    },
  });

// claim with wrong hash

// claim for someone else

