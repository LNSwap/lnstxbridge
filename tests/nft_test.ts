
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = "nft";
const dummyaddress = "SP3HCNR789SGMN18Y4SYBXBP38NB1BPRFVA9P010M";

// standard sip9 tests
Clarinet.test({
    name: "Ensure that user can claim/claim-for/transfer/get-owner/get-token-uri/set-cost-per-mint",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;
        const deployer = accounts.get("deployer")!;
        
        // const assetMaps = chain.getAssetsMaps();
        // console.log(`assetMaps: `, assetMaps);
        // const stxbalance = assetMaps.assets['STX'][deployer.address];
        // const usdabalance = assetMaps.assets[".usda-token.usda"][deployer.address];
        // console.log(`deployer balances: `, stxbalance, usdabalance);

        // chain.mineEmptyBlockUntil(150);
        let block = chain.mineBlock([
            Tx.contractCall(
                contractName,
                "claim",
                [],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "claim-for",
                [types.principal(wallet_2.address)],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "transfer",
                [
                    types.uint(1),
                    types.principal(wallet_1.address),
                    types.principal(wallet_2.address),
                ],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "get-owner",
                [
                    types.uint(2),
                ],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "get-token-uri",
                [
                    types.uint(1),
                ],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "get-last-token-id",
                [
                ],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "transfer",
                [
                    types.uint(1),
                    types.principal(wallet_2.address),
                    types.principal(wallet_1.address),
                ],
                wallet_1.address
              ),
              Tx.contractCall(
                contractName,
                "set-cost-per-mint",
                [
                    types.uint(100000000),
                ],
                wallet_1.address
              ),
              Tx.contractCall(
                contractName,
                "set-cost-per-mint",
                [
                    types.uint(100000000),
                ],
                deployer.address
              ),
              Tx.contractCall(
                contractName,
                "transfer-stx",
                [
                    types.principal(wallet_2.address),
                    types.uint(5000000),
                ],
                deployer.address
              ),
              // tries to withdraw but is not admin
              Tx.contractCall(
                contractName,
                "transfer-stx",
                [
                    types.principal(wallet_2.address),
                    types.uint(5000000),
                ],
                wallet_2.address
              ),
              // doesn't have funds but tries to claim it
              Tx.contractCall(
                contractName,
                "claim",
                [],
                dummyaddress
              ),
              // doesn't own nft but tries to send it
              Tx.contractCall(
                contractName,
                "transfer",
                [
                    types.uint(1),
                    types.principal(wallet_3.address),
                    types.principal(wallet_3.address),
                ],
                wallet_3.address
              ),
              Tx.contractCall(
                contractName,
                "claim-usda",
                [],
                deployer.address
              ),
              Tx.contractCall(
                contractName,
                "claim-usda",
                [],
                dummyaddress
              ),
        ]);
        // console.log('block ', block, block.receipts[0].events[0]);
        // assertEquals(block.height, 151);
        block.receipts[0].result.expectOk().expectUint(1);
        block.receipts[1].result.expectOk().expectUint(2);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectSome().expectPrincipal(wallet_2.address);
        block.receipts[4].result.expectOk().expectSome().expectAscii("ipfs://ipfs/QmNXPcF8PbPve19PwyTiDizrxvjuq7ZzQ6ZVSsv3AYguXg/bolt/{id}.json");
        block.receipts[5].result.expectOk().expectUint(2);
        block.receipts[6].result.expectErr().expectUint(500);
        block.receipts[7].result.expectErr().expectUint(401);
        block.receipts[8].result.expectOk().expectBool(true);
        block.receipts[9].result.expectOk().expectBool(true);
        block.receipts[10].result.expectErr().expectUint(401);
        block.receipts[11].result.expectErr().expectUint(1);
        block.receipts[12].result.expectErr().expectUint(2);

    },
});
