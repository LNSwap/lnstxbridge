import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

function convertBufferInt(account: Account, amount: number) {
    const call = Tx.contractCall(
      "stxswap",
      "buff-to-uint-le",
      [
        `0x${amount.toString(16).padStart(32, "0")}`, // amount
      ],
      account.address
    );
    // console.log(call);
    return call;
  }
  
  function convertBufferIntString(account: Account, amount: string) {
    const call = Tx.contractCall(
      "stxswap",
      "buff-to-uint-le",
      [
        `0x${amount}`, // amount
      ],
      account.address
    );
    // console.log(call);
    return call;
  }
  
  Clarinet.test({
    name: "Ensure that amounts are converted",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const deployer = accounts.get("deployer")!;
  
      let amount = 16_777_216;
      let block = chain.mineBlock([convertBufferInt(deployer, amount)]);
      assertEquals(block.height, 2);
      block.receipts[0].result.expectUint(amount);
  
      amount = 1;
      block = chain.mineBlock([convertBufferInt(deployer, amount)]);
      assertEquals(block.height, 3);
      block.receipts[0].result.expectUint(amount);
  
      block = chain.mineBlock([
        convertBufferIntString(deployer, "".padStart(32, "f")),
      ]);
      assertEquals(block.height, 4);
    //   console.log(block);
      assertEquals(
        block.receipts[0].result,
        "u340282366920938463463374607431768211455"
      );
    },
  });

  Clarinet.test({
    name: "Ensure that user can lock and claim stx",
    async fn(chain: Chain, accounts: Map<string, Account>) {
      const wallet_1 = accounts.get("wallet_1")!;
      const wallet_2 = accounts.get("wallet_2")!;
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
          "stxswap",
          "claimStx",
          [
            `0x01`, //preimage
            `0x${amount.toString(16).padStart(32, "0")}`, // amount
            `0x${"5678".padStart(42, "0")}`, // claimaddress
            `0x${"9abc".padStart(42, "0")}`, // refundaddress
            `0x${"5".padStart(32, "0")}`, // timelock

          ],
          wallet_2.address
        ),
      ]);
    //   console.log(block);
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
      chain.mineEmptyBlockUntil(6);
      block = chain.mineBlock([
        Tx.contractCall(
          "stxswap",
          "refundStx",
          [
            `0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a`, // preimagehash
            `0x${amount.toString(16).padStart(32, "0")}`, // amount
            `0x${"5678".padStart(42, "0")}`, // claimaddress
            `0x${"9abc".padStart(42, "0")}`, // refundaddress
            `0x${"5".padStart(32, "0")}`, // timelock

          ],
          wallet_1.address
        ),
      ]);
    //   console.log(block);
      block.receipts[0].result.expectOk().expectUint(1008);
    },
  });

