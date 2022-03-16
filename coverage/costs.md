
warning: use of 'project.analysis' in Clarinet.toml is deprecated; use repl.analysis.passes
warning: use of 'project.costs_version' in Clarinet.toml is deprecated; use repl.costs_version
nft:19:9: warning: use of potentially unchecked data
  (mint address))
        ^~~~~~~
nft:18:28: note: source of untrusted input here
(define-public (claim-for (address principal))
                           ^~~~~~~
nft:29:34: warning: use of potentially unchecked data
      (match (nft-transfer? cube token-id sender recipient)
                                 ^~~~~~~~
nft:26:27: note: source of untrusted input here
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
                          ^~~~~~~~
nft:29:50: warning: use of potentially unchecked data
      (match (nft-transfer? cube token-id sender recipient)
                                                 ^~~~~~~~~
nft:26:62: note: source of untrusted input here
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
                                                             ^~~~~~~~~
nft:68:32: warning: use of potentially unchecked data
    (ok (var-set cost-per-mint value))
                               ^~~~~
nft:66:36: note: source of untrusted input here
(define-public (set-cost-per-mint (value uint))
                                   ^~~~~
nft:76:33: warning: use of potentially unchecked data
    (as-contract (stx-transfer? amount (as-contract tx-sender) address))
                                ^~~~~~
nft:74:51: note: source of untrusted input here
(define-public (transfer-stx (address principal) (amount uint))
                                                  ^~~~~~
nft:76:64: warning: use of potentially unchecked data
    (as-contract (stx-transfer? amount (as-contract tx-sender) address))
                                                               ^~~~~~~
nft:74:31: note: source of untrusted input here
(define-public (transfer-stx (address principal) (amount uint))
                              ^~~~~~~
sip10swap:28:35: warning: use of potentially unchecked data
    (unwrap-panic (contract-call? tokenPrincipal transfer txamount tx-sender (as-contract tx-sender) none))
                                  ^~~~~~~~~~~~~~
sip10swap:20:170: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount (buff 16)) (tokenAddress (buff 42)) (claimAddress (buff 42)) (timelock (buff 16)) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                                                                                                                         ^~~~~~~~~~~~~~
sip10swap:29:96: warning: use of potentially unchecked data
    (map-set swaps {hash: calculatedHash} {locked: true, initiator: tx-sender, claimPrincipal: claimPrincipal, tokenPrincipal: (contract-of tokenPrincipal)})
                                                                                               ^~~~~~~~~~~~~~
sip10swap:20:143: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount (buff 16)) (tokenAddress (buff 42)) (claimAddress (buff 42)) (timelock (buff 16)) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                                                                                              ^~~~~~~~~~~~~~
sip10swap:29:128: warning: use of potentially unchecked data
    (map-set swaps {hash: calculatedHash} {locked: true, initiator: tx-sender, claimPrincipal: claimPrincipal, tokenPrincipal: (contract-of tokenPrincipal)})
                                                                                                                               ^~~~~~~~~~~~~~~~~~~~~~~~~~~~
sip10swap:20:170: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount (buff 16)) (tokenAddress (buff 42)) (claimAddress (buff 42)) (timelock (buff 16)) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                                                                                                                         ^~~~~~~~~~~~~~
stxswap:25:96: warning: use of potentially unchecked data
    (map-set swaps {hash: calculatedHash} {locked: true, initiator: tx-sender, claimPrincipal: claimPrincipal})
                                                                                               ^~~~~~~~~~~~~~
stxswap:17:142: note: source of untrusted input here
(define-public (lockStx (preimageHash (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (claimPrincipal principal))
                                                                                                                                             ^~~~~~~~~~~~~~
triggerswap:15:31: warning: use of potentially unchecked data
        (try! (contract-call? nftPrincipal claim))
                              ^~~~~~~~~~~~
triggerswap:12:141: note: source of untrusted input here
(define-public (triggerStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (nftPrincipal <claim-trait>))
                                                                                                                                            ^~~~~~~~~~~~
triggerswap:32:31: warning: use of potentially unchecked data
        (try! (contract-call? nftPrincipal claim))
                              ^~~~~~~~~~~~
triggerswap:29:171: note: source of untrusted input here
(define-public (triggerSip10 (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (tokenPrincipal <ft-trait>) (nftPrincipal <claim-trait>))
                                                                                                                                                                          ^~~~~~~~~~~~
usda-token:46:31: warning: use of potentially unchecked data
    (match (ft-transfer? usda amount sender recipient)
                              ^~~~~~
usda-token:42:27: note: source of untrusted input here
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
                          ^~~~~~
usda-token:46:45: warning: use of potentially unchecked data
    (match (ft-transfer? usda amount sender recipient)
                                            ^~~~~~~~~
usda-token:42:60: note: source of untrusted input here
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
                                                           ^~~~~~~~~
Events emitted
{"type":"ft_mint_event","ft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usda-token::usda","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","amount":"1000000000"}}
{"type":"ft_mint_event","ft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usda-token::usda","recipient":"ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF","amount":"1000000000"}}
{"type":"ft_mint_event","ft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usda-token::usda","recipient":"ST1N28QCRR03EW37S470PND4SPECCXQ22ZZHF97GP","amount":"1000000000"}}
Running file:///Users/z/Documents/lnstxbridge/tests/nft-trait_test.ts
Running file:///Users/z/Documents/lnstxbridge/tests/nft_test.ts
* Ensure that <...> ... [0m[32mok[0m [0m[38;5;8m(6ms)[0m
* Ensure that <...> ... [0m[32mok[0m [0m[38;5;8m(7ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/sip10swap_test.ts
* Ensure that amounts are converted ... [0m[32mok[0m [0m[38;5;8m(47ms)[0m
* Ensure that user can lock and claim sip9 or sip10 tokens ... [0m[32mok[0m [0m[38;5;8m(50ms)[0m
* Ensure that user can lock and refund sip9 or sip10 tokens ... [0m[32mok[0m [0m[38;5;8m(49ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/stxwap_init_test.ts
* Ensure that amounts are converted ... [0m[32mok[0m [0m[38;5;8m(47ms)[0m
* Ensure that user can lock stx ... [0m[32mok[0m [0m[38;5;8m(32ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/triggerswap_v1_test.ts
* Ensure that user can lock and trigger stx transfer to another address ... [0m[32mok[0m [0m[38;5;8m(58ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/stxswap_test.ts
* Ensure that amounts are converted ... [0m[32mok[0m [0m[38;5;8m(46ms)[0m
* Ensure that user can lock and claim stx ... [0m[32mok[0m [0m[38;5;8m(49ms)[0m
* Ensure that user can lock and refund stx ... [0m[32mok[0m [0m[38;5;8m(61ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/claim-for-trait_test.ts
* Ensure that <...> ... [0m[32mok[0m [0m[38;5;8m(5ms)[0m

test result: [0m[32mok[0m. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out [0m[38;5;8m(2207ms)[0m


Contract calls cost synthesis
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
|                                   | Runtime (units) | Read Count | Read Length (bytes) | Write Count | Write Length (bytes) | Tx per Block |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::buff-to-uint-le        |  212633 (0.00%) |  3 (0.04%) |        7415 (0.01%) |           0 |                    0 |         2583 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::claimToken             |  477143 (0.01%) | 12 (0.15%) |       10256 (0.01%) |   3 (0.04%) |           55 (0.00%) |          645 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::lockToken              |  262337 (0.01%) | 10 (0.13%) |        9649 (0.01%) |   3 (0.04%) |          606 (0.00%) |          775 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::refundToken            |  476889 (0.01%) | 12 (0.15%) |       10256 (0.01%) |   3 (0.04%) |           55 (0.00%) |          645 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::buff-to-uint-le          |  211993 (0.00%) |  3 (0.04%) |        6775 (0.01%) |           0 |                    0 |         2583 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::claimStx                 |  246503 (0.00%) |  7 (0.09%) |        7624 (0.01%) |   2 (0.03%) |           55 (0.00%) |         1107 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::lockStx                  |  445680 (0.01%) |  6 (0.08%) |        7200 (0.01%) |   2 (0.03%) |          425 (0.00%) |         1291 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::refundStx                |  452300 (0.01%) |  8 (0.10%) |        7626 (0.01%) |   2 (0.03%) |           55 (0.00%) |          968 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| triggerswap::triggerTransferStx   |  463570 (0.01%) | 11 (0.14%) |       11642 (0.01%) |   3 (0.04%) |           56 (0.00%) |          704 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
|                                                                                                                                            |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| Mainnet Block Limits (Stacks 2.0) |      5000000000 |       7750 |           100000000 |        7750 |             15000000 |            / |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+


----------------------------
Check out the pro tips to improve your testing process:

  $ clarinet test --watch
    Watch for file changes an re-run all tests.

  $ clarinet test --costs
    Run a cost analysis of the contracts covered by tests.

  $ clarinet test --coverage
    Measure test coverage with the LCOV tooling suite.

Once you are ready to test your contracts on a local developer network, run the following:

  $ clarinet integrate
    Deploy all contracts to a local dockerized blockchain setup (Devnet).

Find more information on testing with Clarinet here: https://docs.hiro.so/smart-contracts/clarinet#testing-with-clarinet
And learn more about local integration testing here: https://docs.hiro.so/smart-contracts/devnet
Disable these hints with the env var CLARINET_DISABLE_HINTS=1
----------------------------
