
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
sip10swap:27:35: warning: use of potentially unchecked data
    (unwrap-panic (contract-call? tokenPrincipal transfer amount tx-sender (as-contract tx-sender) none))
                                  ^~~~~~~~~~~~~~
sip10swap:23:110: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                                                             ^~~~~~~~~~~~~~
sip10swap:28:27: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock,  initiator: tx-sender, claimPrincipal: claimPrincipal, tokenPrincipal: (contract-of tokenPrincipal)})
                          ^~~~~~~~~~~~
sip10swap:23:28: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                           ^~~~~~~~~~~~
sip10swap:28:68: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock,  initiator: tx-sender, claimPrincipal: claimPrincipal, tokenPrincipal: (contract-of tokenPrincipal)})
                                                                   ^~~~~~~~
sip10swap:23:67: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                  ^~~~~~~~
sip10swap:28:117: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock,  initiator: tx-sender, claimPrincipal: claimPrincipal, tokenPrincipal: (contract-of tokenPrincipal)})
                                                                                                                    ^~~~~~~~~~~~~~
sip10swap:23:83: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                                  ^~~~~~~~~~~~~~
sip10swap:28:149: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock,  initiator: tx-sender, claimPrincipal: claimPrincipal, tokenPrincipal: (contract-of tokenPrincipal)})
                                                                                                                                                    ^~~~~~~~~~~~~~~~~~~~~~~~~~~~
sip10swap:23:110: note: source of untrusted input here
(define-public (lockToken (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal) (tokenPrincipal <ft-trait>))
                                                                                                             ^~~~~~~~~~~~~~
sip10swap:49:30: warning: use of potentially unchecked data
    (map-delete swaps {hash: preimageHash})
                             ^~~~~~~~~~~~
sip10swap:39:29: note: source of untrusted input here
(define-public (claimToken (preimage (buff 32)) (amount uint) (tokenPrincipal <ft-trait>))
                            ^~~~~~~~
sip10swap:70:30: warning: use of potentially unchecked data
    (map-delete swaps {hash: preimageHash})
                             ^~~~~~~~~~~~
sip10swap:61:30: note: source of untrusted input here
(define-public (refundToken (preimageHash (buff 32)) (tokenPrincipal <ft-trait>))
                             ^~~~~~~~~~~~
stxswap:26:27: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock, initiator: tx-sender, claimPrincipal: claimPrincipal})
                          ^~~~~~~~~~~~
stxswap:21:26: note: source of untrusted input here
(define-public (lockStx (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal))
                         ^~~~~~~~~~~~
stxswap:26:68: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock, initiator: tx-sender, claimPrincipal: claimPrincipal})
                                                                   ^~~~~~~~
stxswap:21:65: note: source of untrusted input here
(define-public (lockStx (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal))
                                                                ^~~~~~~~
stxswap:26:116: warning: use of potentially unchecked data
    (map-set swaps {hash: preimageHash} {amount: amount, timelock: timelock, initiator: tx-sender, claimPrincipal: claimPrincipal})
                                                                                                                   ^~~~~~~~~~~~~~
stxswap:21:81: note: source of untrusted input here
(define-public (lockStx (preimageHash (buff 32)) (amount uint) (timelock uint) (claimPrincipal principal))
                                                                                ^~~~~~~~~~~~~~
stxswap:45:40: warning: use of potentially unchecked data
    (asserts! (map-delete swaps {hash: preimageHash}) (err err-swap-not-found))
                                       ^~~~~~~~~~~~
stxswap:36:27: note: source of untrusted input here
(define-public (claimStx (preimage (buff 32)) (amount uint))
                          ^~~~~~~~
stxswap:63:30: warning: use of potentially unchecked data
    (map-delete swaps {hash: preimageHash})
                             ^~~~~~~~~~~~
stxswap:55:28: note: source of untrusted input here
(define-public (refundStx (preimageHash (buff 32)))
                           ^~~~~~~~~~~~
triggerswap:15:31: warning: use of potentially unchecked data
        (try! (contract-call? nftPrincipal claim))
                              ^~~~~~~~~~~~
triggerswap:12:64: note: source of untrusted input here
(define-public (triggerStx (preimage (buff 32)) (amount uint) (nftPrincipal <claim-trait>))
                                                               ^~~~~~~~~~~~
triggerswap:32:31: warning: use of potentially unchecked data
        (try! (contract-call? nftPrincipal claim))
                              ^~~~~~~~~~~~
triggerswap:29:94: note: source of untrusted input here
(define-public (triggerSip10 (preimage (buff 32)) (amount uint) (tokenPrincipal <ft-trait>) (nftPrincipal <claim-trait>))
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
Running file:///Users/z/Documents/lnstxbridge/tests/nft_test.ts
* Ensure that <...> ... [0m[32mok[0m [0m[38;5;8m(3ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/nft-trait_test.ts
* Ensure that <...> ... [0m[32mok[0m [0m[38;5;8m(4ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/sip10swap_test.ts
* Ensure that user can lock and claim sip9 or sip10 tokens ... [0m[32mok[0m [0m[38;5;8m(13ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/triggerswap_v1_test.ts
* Ensure that user can lock and refund sip9 or sip10 tokens ... [0m[32mok[0m [0m[38;5;8m(14ms)[0m
* Ensure that user can lock and trigger stx transfer to another address ... [0m[32mok[0m [0m[38;5;8m(19ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/stxswap_test.ts
* Ensure that user can lock and claim stx ... [0m[32mok[0m [0m[38;5;8m(9ms)[0m
* Ensure that user can lock and refund stx ... [0m[32mok[0m [0m[38;5;8m(10ms)[0m
Running file:///Users/z/Documents/lnstxbridge/tests/claim-for-trait_test.ts
* Ensure that <...> ... [0m[32mok[0m [0m[38;5;8m(4ms)[0m

test result: [0m[32mok[0m. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out [0m[38;5;8m(1105ms)[0m


Contract calls cost synthesis
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
|                                   | Runtime (units) | Read Count | Read Length (bytes) | Write Count | Write Length (bytes) | Tx per Block |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::claimToken             |   49696 (0.00%) | 10 (0.13%) |        5974 (0.01%) |   3 (0.04%) |           55 (0.00%) |          775 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::lockToken              |   41806 (0.00%) | 10 (0.13%) |        5974 (0.01%) |   3 (0.04%) |          658 (0.00%) |          775 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| sip10swap::refundToken            |   52831 (0.00%) | 11 (0.14%) |        5976 (0.01%) |   3 (0.04%) |           55 (0.00%) |          704 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::claimStx                 |   27491 (0.00%) |  6 (0.08%) |        3450 (0.00%) |   2 (0.03%) |           55 (0.00%) |         1291 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::lockStx                  |   20216 (0.00%) |  6 (0.08%) |        3450 (0.00%) |   2 (0.03%) |          477 (0.00%) |         1291 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| stxswap::refundStx                |   27430 (0.00%) |  7 (0.09%) |        3452 (0.00%) |   2 (0.03%) |           55 (0.00%) |         1107 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| triggerswap::triggerTransferStx   |   36209 (0.00%) | 10 (0.13%) |        4735 (0.00%) |   3 (0.04%) |           56 (0.00%) |          775 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
|                                                                                                                                            |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| Mainnet Block Limits (Stacks 2.0) |      5000000000 |       7750 |           100000000 |        7750 |             15000000 |            / |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+

