import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
  assertEquals,
} from "../test/deps.ts";

function convertBufferInt(account: Account, amount: number) {
  const call = Tx.contractCall(
    "stxswap",
    "buff-to-uint-le",
    [
      `0x${amount.toString(16).padStart(32, "0")}`, // amount
    ],
    account.address
  );
  console.log(call);
  return call;
}

Clarinet.test({
  name: "Ensure that user can lock stx",
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

    amount = Number.MAX_SAFE_INTEGER;
    block = chain.mineBlock([convertBufferInt(deployer, amount)]);
    assertEquals(block.height, 4);
    block.receipts[0].result.expectUint(amount);
  },
});
