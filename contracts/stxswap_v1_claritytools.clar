;; map that holds all swaps
;; true: swap with hash has stx locked
;; false: swap with hash does not exist
(define-map swaps {hash: (buff 32)} {locked: bool})

;; hashValues - convert all inputs to string and concat for hashing
;; @param preimageHash Preimage hash of the swap - ada5967db4c9feb258f6d0ed30d1a90c0feca7bd4888698448702de0ee35b06a
;; @param amount Amount the swap has locked in stx - 10
;; @param claimAddress Address that can claim the locked stx
;; @param refundAddress Address that locked the stx and can refund them
;; @param timelock Block height after which the locked stx can be refunded
;; @return Value hash of the swap
; (define-private (hashValues (preimageHash (string-ascii 99)) (amount (string-ascii 99)) (claimAddress (string-ascii 99)) (refundAddress (string-ascii 99)) (timelock (string-ascii 99)))
;   (keccak256 (concat preimageHash amount claimAddress refundAddress timelock)))


(define-private (hashValuesbuf (preimageHash (buff 32)) (amount (buff 32)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 32)))
  (keccak256 (concat preimageHash amount claimAddress refundAddress timelock)))


;; Locks stx in the contract
;; @notice The refund address is the sender of the transaction
;; @param preimageHash Preimage hash of the swap
;; @param amount Amount to be locked in the contract
;; @param claimAddress Address that can claim the locked stx
;; @param timelock Block height after which the locked stx can be refunded
;; (define-public (lockStx (preimageHash (string-ascii 99)) (amount (string-ascii 99)) (claimAddress (string-ascii 99)) (refundAddress (string-ascii 99)) (timelock (string-ascii 99)))
; (define-public (lockStx (preimageHash (buff 32)) (amount (buff 32)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 32)))

;   ;; Locking zero stx in the contract is pointless
;   ;; (asserts! (not (is-eq amount "0")) (err 1))

;   (let ((hash (hashValuesbuf preimageHash amount claimAddress refundAddress timelock)))
    
;      (
;       ;; Make sure no swap with this value hash exists yet
;       ;; (asserts! (is-eq (map-get? swaps {hash: hash}) false) (err 2))
;       (asserts! (is-eq (checkSwapIsLocked hash) false) (err 2))

;       ;; Save to the state that funds were locked for this swap
;       (map-set swaps {hash: hash} {locked: true}))))

 
;; clarity-cli validated version    
(define-public (lockStx (preimageHash (buff 32)) (amount (buff 32)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 32)))
  (begin
    (asserts! (is-eq (checkSwapIsLocked (hashValuesbuf preimageHash amount claimAddress refundAddress timelock)) false) (err false))
    (map-set swaps {hash: (hashValuesbuf preimageHash amount claimAddress refundAddress timelock)} {locked: true})
    (ok true)
  )
)  

;; more params
(define-public (lockStx (preimageHash (buff 32)) (amount (buff 32)) (amountu uint) (claimAddress (buff 42)) (claimAddressp principal) (refundAddress (buff 42)) (refundAddressp principal) (timelock (buff 32)) (timelocku uint))  
  (begin    (asserts! (is-eq (checkSwapIsLocked (hashValuesbuf preimageHash amount claimAddress refundAddress timelock)) false) (err false))    
    (map-set swaps {hash: (hashValuesbuf preimageHash amount claimAddress refundAddress timelock)} {locked: true, amount: amountu, claimAddress: claimAddressp,refundAddress: refundAddressp, timelock: timelockp})    
    (ok true)))


;; Claims stx locked in the contract
;; @param preimage Preimage of the swap
;; @param amount Amount locked in the contract for the swap in stx
;; @param refundAddress Address that locked the stx in the contract
;; @param timelock Block height after which the locked stx can be refunded
;; (define-public (claimStx (preimage (string-ascii 99)) (amount (string-ascii 99)) (refundAddress (string-ascii 99)) (timelock (string-ascii 99)))
(define-public (claimStx (preimage (buff 32)) (amount (buff 32)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 32)))
  (let ((preimageHash (sha256 preimage)) (hash (hashValuesbuf preimageHash amount claimAddress refundAddress timelock)))
                                           (begin
                                             ((asserts! (is-eq (checkSwapIsLocked hash) false) (err 2)))  
                                             (map-delete swaps {hash: hash})
                                             (stx-transfer? (to-int amount) (as-contract tx-sender) tx-sender))))
        

(define-public (claimStx (preimage (buff 32)) (amount (buff 32)) (claimAddress (buff 42)) (refundAddress (buff 42)) (timelock (buff 32)))
  (begin
    ((asserts! (is-eq (checkSwapIsLocked (hashValuesbuf (sha256 preimage) amount claimAddress refundAddress timelock)) false) (err 2)))
    (map-delete swaps {hash: (hashValuesbuf (sha256 preimage) amount claimAddress refundAddress timelock)})
    (stx-transfer? (to-int amount) (as-contract tx-sender) tx-sender)
  )
)
  


;; Checks whether a swap has Ether locked in the contract
;; @dev This function reverts if the swap has no stx locked in the contract
;; @param hash Value hash of the swap
(define-public (checkSwapIsLocked (hash (buff 32)))
  (default-to false (get locked (map-get? swaps {hash: hash}))))



;;tests
(ok tx-sender)
(hashValuesbuf 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 0x1 0x1 0x1 0x1)
(lockStx 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 0x1 0x1 0x1 0x1)
(checkSwapIsLocked 0xe1215c7009f6581792705337cc9d28d3b6a713134931feb79902cdf5546caec5)
(claimStx 0x1 0x1 0x1 0x1 0x1)









