;;;;;;;;;;;;;;;;;;;;; SIP 010 ;;;;;;;;;;;;;;;;;;;;;;
;; mainnet sip10 trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE
(impl-trait .sip-010-trait.sip-010-trait)

(define-constant contract-creator tx-sender)

;; Defines the USDA Stablecoin according to the SIP-010 Standard
(define-fungible-token usda)

;; errors
(define-constant ERR-NOT-AUTHORIZED u401)

;; Mint initial token
(ft-mint? usda u100000 contract-creator)
(ft-mint? usda u100000 'ST27SD3H5TTZXPBFXHN1ZNMFJ3HNE2070QX7ZN4FF)
(ft-mint? usda u100000 'ST1N28QCRR03EW37S470PND4SPECCXQ22ZZHF97GP)

;; ---------------------------------------------------------
;; SIP-10 Functions
;; ---------------------------------------------------------

(define-read-only (get-total-supply)
  (ok (ft-get-supply usda))
)

(define-read-only (get-name)
  (ok "USDA")
)

(define-read-only (get-symbol)
  (ok "USDA")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance usda account))
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) (err ERR-NOT-AUTHORIZED))

    (match (ft-transfer? usda amount sender recipient)
      response (begin
        (print memo)
        (ok response)
      )
      error (err error)
    )
  )
)

;; dummy token-uri
(define-public (get-token-uri)
  (ok (some u"https://heystack.xyz/token-metadata.json")))

(define-public (gift-tokens (recipient principal))
  (begin
    (asserts! (is-eq tx-sender recipient) (err u0))
    (ft-mint? usda u1 recipient)
  )
)