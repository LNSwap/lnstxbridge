;; use the SIP090 interface
(impl-trait .nft-trait.nft-trait)

(define-non-fungible-token cube uint)

;; Constants
(define-constant ERR-ALL-MINTED u101)
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED u401)
(define-constant MINT-LIMIT u1000)

;; Store the last issues token ID
(define-data-var last-id uint u0)
(define-data-var cost-per-mint uint u5000000)
(define-data-var ipfs-root (string-ascii 102) "ipfs://ipfs/QmNXPcF8PbPve19PwyTiDizrxvjuq7ZzQ6ZVSsv3AYguXg/bolt/")

;; Claim for an address
(define-public (claim-for (address principal))
  (mint address))

;; Claim a new NFT
(define-public (claim)
  (mint tx-sender))

;; Claim a new NFT with sip10 token
(define-public (claim-usda)
  (mint-usda tx-sender))

;; SIP009: Transfer token to a specified principal
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (if (and
        (is-eq tx-sender sender))
      (match (nft-transfer? cube token-id sender recipient)
        success (ok success)
        error (err error))
      (err u500)))

;; SIP009: Get the owner of the specified token ID
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? cube token-id)))

;; SIP009: Get the last token ID
(define-read-only (get-last-token-id)
  (ok (var-get last-id)))

;; SIP009: Get the token URI. You can set it to any other URI
(define-read-only (get-token-uri (token-id uint))
    (ok (some (concat (concat (var-get ipfs-root) "{id}") ".json")))
)

;; Internal - Mint new NFT
(define-private (mint (new-owner principal))
  (let (
        (next-id (+ u1 (var-get last-id)))  
        (count (var-get last-id))
      )
      (asserts! (< count MINT-LIMIT) (err ERR-ALL-MINTED))
        (match (stx-transfer? (var-get cost-per-mint) tx-sender (as-contract tx-sender))
          success (begin
            (try! (nft-mint? cube next-id new-owner))
            (var-set last-id next-id)
            (ok next-id)
          ) 
          error (err error)
          )
          )
        )

;; Internal - Mint new NFT
(define-private (mint-usda (new-owner principal))
  (let (
        (next-id (+ u1 (var-get last-id)))  
        (count (var-get last-id))
      )
      (asserts! (< count MINT-LIMIT) (err ERR-ALL-MINTED))
        (match 
          (contract-call? .usda-token transfer (var-get cost-per-mint) tx-sender (as-contract tx-sender) none)
          success (begin
            (try! (nft-mint? cube next-id new-owner))
            (var-set last-id next-id)
            (ok next-id)
          ) 
          error (err error)
          )
          )
        )

;; Allows contract owner to change mint price
(define-public (set-cost-per-mint (value uint))
  (if (is-eq tx-sender CONTRACT-OWNER)
    (ok (var-set cost-per-mint value))
    (err ERR-NOT-AUTHORIZED)
  )
)

;; Transfers stx from contract to contract owner
(define-public (transfer-stx (address principal) (amount uint))
  (if (is-eq tx-sender CONTRACT-OWNER)
    (as-contract (stx-transfer? amount (as-contract tx-sender) address))
    (err ERR-NOT-AUTHORIZED)
  )
)