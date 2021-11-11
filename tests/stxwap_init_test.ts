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

function convertBufferIntString(account: Account, amount: string) {
  const call = Tx.contractCall(
    "stxswap",
    "buff-to-uint-le",
    [
      `0x${amount}`, // amount
    ],
    account.address
  );
  console.log(call);
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
    console.log(block);
    assertEquals(
      block.receipts[0].result,
      "u340282366920938463463374607431768211455"
    );
  },
});

Clarinet.test({
  name: "Ensure that user can lock stx",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const amount = 1_000;
    let block = chain.mineBlock([
      Tx.contractCall(
        "stxswap",
        "lockStx",
        [
          `0x${"1234".padStart(32, "0")}`, // preimagehash
          `0x${amount.toString(16).padStart(32, "0")}`, // amount
          `0x${"5678".padStart(42, "0")}`, // claimaddress
          `0x${"9abc".padStart(42, "0")}`, // refundaddress
          `0x1234`, // timelock
          types.principal(wallet_2.address),
        ],
        wallet_1.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});
