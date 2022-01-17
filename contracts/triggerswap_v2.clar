;; triggers claimstx from lnswap and claim-for from any nft for trustless LN purchases.

;; claim/mint an nft for a principal
(define-trait claim-for-trait
  (
    (claim-for (principal) (response uint uint))
  )
)

;; mainnet 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (triggerStx (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (nftPrincipal <claim-for-trait>) (userPrincipal principal))
    (begin 
        (try! (contract-call? .stxswap claimStx preimage amount claimAddress refundAddress timelock))
        (try! (contract-call? nftPrincipal claim-for userPrincipal))
        (ok true)
    )
)

(define-public (triggerSip10 (preimage (buff 32)) (amount (buff 16)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 16)) (tokenPrincipal <ft-trait>) (nftPrincipal <claim-for-trait>) (userPrincipal principal))
    (begin 
        (try! (contract-call? .sip10swap claimToken preimage amount claimAddress refundAddress timelock tokenPrincipal))
        (try! (contract-call? nftPrincipal claim-for userPrincipal))
        (ok true)
    )
)