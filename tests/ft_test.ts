
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
// import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const contractName = "usda-token";

// standard sip10 tests
Clarinet.test({
    name: "Ensure that user can transfer/get-token-uri/set-cost-per-mint",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;
        const deployer = accounts.get("deployer")!;
        let block = chain.mineBlock([
            Tx.contractCall(
                contractName,
                "transfer",
                [
                    types.uint(5000000),
                    types.principal(deployer.address),
                    types.principal(wallet_2.address),
                    types.some(types.buff(new TextEncoder().encode('sample memo')))
                ],
                deployer.address
              ),
            Tx.contractCall(
                contractName,
                "transfer",
                [
                    types.uint(5000000),
                    types.principal(wallet_3.address),
                    types.principal(wallet_2.address),
                    types.some(types.buff(new TextEncoder().encode('sample memo')))
                ],
                wallet_3.address
            ),
            Tx.contractCall(
                contractName,
                "get-token-uri",
                [
                ],
                wallet_1.address
              ),
            Tx.contractCall(
                contractName,
                "gift-tokens",
                [
                    types.principal(wallet_2.address)
                ],
                wallet_2.address
              ),
        ]);
        const totalSupply = chain.callReadOnlyFn(
            contractName,
            "get-total-supply",
            [
            ],
            wallet_1.address
        );
        totalSupply.result.expectOk().expectUint(4000000000);

        const assetName = chain.callReadOnlyFn(
            contractName,
            "get-name",
            [
            ],
            wallet_1.address
        );
        assetName.result.expectOk().expectAscii("USDA");
        
        const assetSymbol = chain.callReadOnlyFn(
            contractName,
            "get-symbol",
            [
            ],
            wallet_1.address
        );
        assetSymbol.result.expectOk().expectAscii("USDA");

        const assetDecimals = chain.callReadOnlyFn(
            contractName,
            "get-decimals",
            [
            ],
            wallet_1.address
        );
        assetDecimals.result.expectOk().expectUint(6);

        const userBalance = chain.callReadOnlyFn(
            contractName,
            "get-balance",
            [
                types.principal(deployer.address)
            ],
            wallet_1.address
        );
        userBalance.result.expectOk().expectUint(995000000);

        // console.log('block ', block, block.receipts[0].events[0]);
        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectErr().expectUint(1);
        block.receipts[2].result.expectOk().expectSome().expectUtf8("https://some.token/token-metadata.json");
        block.receipts[3].result.expectOk().expectBool(true);
    },
});
