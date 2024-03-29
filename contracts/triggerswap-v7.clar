;; LNSwap external atomic swap triggers
;; triggers claim from lnswap contracts and mint/transfer to any contract/principal for trustless LN -> STX interaction.

(define-trait claim-trait
  (
    (claim () (response uint uint))
  )
)

(define-trait claim-usda-trait
  (
    (claim-usda () (response uint uint))
  )
)

(define-trait trustless-rewards-trait
  (
    (create-lobby ((string-ascii 99) uint uint uint (string-ascii 30) (string-ascii 10) (string-ascii 10) (string-ascii 10) uint) (response uint uint))

    (join (uint) (response uint uint))
  )
)

;; TODO: update .stxswap -> .stxswap_v10/sip10swap_v3
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (triggerStx (preimage (buff 32)) (amount uint) (nftPrincipal <claim-trait>))
    (begin 
        (try! (contract-call? .stxswap claimStx preimage amount))
        (try! (contract-call? nftPrincipal claim))
        (ok true)
    )
)

(define-public (triggerTransferStx (preimage (buff 32)) (amount uint) (receiver principal) (memo (string-ascii 40)))
    (begin
        (try! (contract-call? .stxswap claimStx preimage amount))
        (try! (stx-transfer? amount tx-sender receiver))
        (print {action: "transfer", address: tx-sender, memo: memo})
        (ok true)
    )
)

(define-public (triggerSip10 (preimage (buff 32)) (amount uint) (tokenPrincipal <ft-trait>) (nftPrincipal <claim-usda-trait>))
    (begin 
        (try! (contract-call? .sip10swap claimToken preimage amount tokenPrincipal))
        (try! (contract-call? nftPrincipal claim-usda))
        (ok true)
    )
)

(define-public (triggerCreateLobby (preimage (buff 32)) (amount uint) (description (string-ascii 99)) (price uint) (factor uint) (commission uint) 
  (mapy (string-ascii 30)) (length (string-ascii 10)) (traffic (string-ascii 10)) (curves (string-ascii 10)) (hours uint) (contractPrincipal <trustless-rewards-trait>))
    (begin 
        (try! (contract-call? .stxswap claimStx preimage amount))
        (try! (contract-call? contractPrincipal create-lobby description price factor commission mapy length traffic curves hours))
        (ok true)
    )
)

(define-public (triggerJoinLobby (preimage (buff 32)) (amount uint) (id uint) (contractPrincipal <trustless-rewards-trait>))
    (begin 
        (try! (contract-call? .stxswap claimStx preimage amount))
        (try! (contract-call? contractPrincipal join id))
        (ok true)
    )
)

(define-public (triggerStacking (preimage (buff 32)) (amount uint) (delegatePrincipal principal) (until-burn-ht (optional uint)))
    (begin 
        (try! (contract-call? .stxswap claimStx preimage amount))
        ;; testnet 'ST000000000000000000002AMW42H.pox
        ;; mainnet/clarinet 'SP000000000000000000002Q6VF78.pox
        (unwrap-panic (contract-call? 'SP000000000000000000002Q6VF78.pox delegate-stx amount delegatePrincipal until-burn-ht none))
        (ok true)
    )
)