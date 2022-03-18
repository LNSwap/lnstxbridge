import { BigNumber } from 'ethers';
import Logger from '../Logger';
import { PairConfig } from '../consts/Types';
import DataAggregator from './data/DataAggregator';
import { BaseFeeType, OrderSide } from '../consts/Enums';
import { etherDecimals, gweiDecimals } from '../consts/Consts';
import { getChainCurrency, getPairId, mapToObject, splitPairId, stringify } from '../Utils';
import { calculateStacksTxFee, getInfo, getStacksNetwork } from '../wallet/stacks/StacksUtils';
// calculateStxLockFee
import { randomBytes } from 'crypto';

type ReverseMinerFees = {
  lockup: number;
  claim: number;
};

type MinerFees = {
  normal: number;
  reverse: ReverseMinerFees;
};

class FeeProvider {
  // A map between the symbols of the pairs and their percentage fees
  public percentageFees = new Map<string, number>();

  public minerFees = new Map<string, MinerFees>();

  public static transactionSizes = {
    // The claim transaction which spends a nested SegWit swap output and sends it to a P2WPKH address has about 170 vbytes
    normalClaim: 170,

    // We cannot know what kind of address the user will claim to so we just assume the worst case: P2PKH
    // Claiming a P2WSH to a P2PKH address is about 138 bytes
    reverseClaim: 138,

    // The lockup transaction which spends a P2WPKH output (possibly more but we assume a best case scenario here),
    // locks up funds in a P2WSH swap and sends the change back to a P2WKH output has about 153 vbytes
    reverseLockup: 153,
  };

  // TODO: query those estimations from the provider
  public static gasUsage = {
    EtherSwap: {
      lockup: 46460,
      claim: 24924,
      refund: 23372,
    },
    ERC20Swap: {
      lockup: 86980,
      claim: 24522,
      refund: 23724,
    },
  };

  constructor(
    private logger: Logger,
    private dataAggregator: DataAggregator,
    private getFeeEstimation: (symbol: string) => Promise<Map<string, number>>,
  ) {}

  public init = (pairs: PairConfig[]): void => {
    pairs.forEach((pair) => {
      // Set the configured fee or fallback to 1% if it is not defined
      const percentage = pair.fee !== undefined ? pair.fee : 1;

      if (pair.fee === undefined) {
        this.logger.warn(`Setting default fee of ${percentage}% for pair ${pair.base}/${pair.quote} because none was specified`);
      }

      this.percentageFees.set(getPairId(pair), percentage / 100);
    });

    this.logger.debug(`Prepared data for fee estimations: ${stringify(mapToObject(this.percentageFees))}`);
  }

  public getPercentageFee = (pair: string): number => {
    return this.percentageFees.get(pair) || 0;
  }

  public getFees = (
    pair: string,
    rate: number,
    orderSide: OrderSide,
    amount: number,
    type: BaseFeeType,
  ): {
    baseFee: number,
    percentageFee: number,
  } => {
    let percentageFee = this.getPercentageFee(pair);

    if (percentageFee !== 0) {
      percentageFee = percentageFee * amount * rate;
    }

    const { base, quote } = splitPairId(pair);
    const chainCurrency = getChainCurrency(base, quote, orderSide, type !== BaseFeeType.NormalClaim);

    return {
      percentageFee: Math.ceil(percentageFee),
      baseFee: this.getBaseFee(chainCurrency, type),
    };
  }

  public getBaseFee = (chainCurrency: string, type: BaseFeeType): number => {
    const minerFeeMap = this.minerFees.get(chainCurrency)!;
    // console.log("feeprovider.104 minerFeeMap: ", chainCurrency, minerFeeMap);

    let baseFee: number;

    switch (type) {
      case BaseFeeType.NormalClaim:
        baseFee = minerFeeMap.normal;
        break;

      case BaseFeeType.ReverseClaim:
        baseFee = minerFeeMap.reverse.claim;
        break;

      case BaseFeeType.ReverseLockup:
        baseFee = minerFeeMap.reverse.lockup;
        break;
    }

    // console.log("feeprovider.122 baseFee: ", chainCurrency, baseFee);
    return baseFee;
  }

  public updateMinerFees = async (chainCurrency: string): Promise<void> => {
    // this.logger.error("feeprovider.125 chainCurrency "+ chainCurrency);

    const feeMap = await this.getFeeEstimation(chainCurrency);

    // TODO: avoid hard coding symbols
    switch (chainCurrency) {
      case 'BTC':
      case 'LTC': {
        const relativeFee = feeMap.get(chainCurrency)!;

        this.minerFees.set(chainCurrency, {
          normal: relativeFee * FeeProvider.transactionSizes.normalClaim,
          reverse: {
            claim: relativeFee * FeeProvider.transactionSizes.reverseClaim,
            lockup: relativeFee * FeeProvider.transactionSizes.reverseLockup,
          },
        });

        break;
      }

      case 'ETH': {
        const relativeFee = feeMap.get(chainCurrency)!;
        const claimCost = this.calculateEtherGasCost(relativeFee, FeeProvider.gasUsage.EtherSwap.claim);

        this.minerFees.set(chainCurrency, {
          normal: claimCost,
          reverse: {
            claim: claimCost,
            lockup: this.calculateEtherGasCost(relativeFee, FeeProvider.gasUsage.EtherSwap.lockup),
          },
        });

        break;
      }

      case 'RBTC': {
        const relativeFee = feeMap.get(chainCurrency)!;
        const claimCost = this.calculateEtherGasCost(relativeFee, FeeProvider.gasUsage.EtherSwap.claim);

        this.minerFees.set(chainCurrency, {
          normal: claimCost,
          reverse: {
            claim: claimCost,
            lockup: this.calculateEtherGasCost(relativeFee, FeeProvider.gasUsage.EtherSwap.lockup),
          },
        });

        break;
      }

      case 'USDA':
      case 'STX': {
        // const relativeFee = feeMap.get(chainCurrency)!;
        const preimage = randomBytes(32);
        const timelock = ((await getInfo()).stacks_tip_height + Math.floor(Math.random()*200)).toString(16).padStart(32, '0');
        const amount = Math.floor(Math.random()*20000000).toString(16).padStart(32, '0');
        const dummyPrincipal = getStacksNetwork().stxSwapAddress.split('.')[0];
        const lockupCost = await calculateStacksTxFee(getStacksNetwork().stxSwapAddress, 'lockStx', amount, timelock, preimage, undefined, dummyPrincipal);
        const claimCost = await calculateStacksTxFee(getStacksNetwork().stxSwapAddress, 'claimStx', amount, timelock, undefined, preimage);
        const refundCost = await calculateStacksTxFee(getStacksNetwork().stxSwapAddress, 'refundStx', amount, timelock, preimage, undefined);
        this.logger.verbose(`feeprovider.191 ${chainCurrency}:: lockupCost ${lockupCost}, claimCost ${claimCost}, refundCost ${refundCost}`);

        // const dynLockCost = await calculateStxLockFee(getStacksNetwork().stxSwapAddress,'8c0640c4d4f0d5923d441037b2ea7406eb62869db5a085105492ad93eb72773f');
        // const dynClaimCost = await calculateStxClaimFee(getStacksNetwork().stxSwapAddress,'qqwe');
        // this.logger.debug(`feeprovider.186 dynLockCost: ${dynLockCost}`);

        // const claimCost = this.calculateEtherGasCost(relativeFee, FeeProvider.gasUsage.EtherSwap.claim);
        // claimcost is wrong for STX but that should be OK.
        // this.logger.error("feeprovider.181 TODO: NO CLAIM/LOCK FEE estimation yet!! -relativeFee, stxclaimCost " + relativeFee + ", " +claimCost)
        // DONE!
        // this.logger.debug(`feeprovider.181 relativeFee, stxclaimCost, lockupCost: ${relativeFee}, ${claimCost}, ${lockupCost}`);

        this.minerFees.set(chainCurrency, {
          // normal: relativeFee,
          normal: claimCost,
          reverse: {
            // claim: relativeFee,
            claim: claimCost,
            lockup: lockupCost,
            // lockup: relativeFee,
            // lockup: this.calculateEtherGasCost(relativeFee, FeeProvider.gasUsage.EtherSwap.lockup),
          },
        });

        break;
      }

      // If it is not BTC, LTC or ETH, it is an ERC20 token
      default: {
        const relativeFee = feeMap.get('ETH')!;
        const rate = this.dataAggregator.latestRates.get(getPairId({ base: 'ETH', quote: chainCurrency }))!;

        const claimCost = this.calculateTokenGasCosts(
          rate,
          relativeFee,
          FeeProvider.gasUsage.ERC20Swap.claim,
        );

        this.minerFees.set(chainCurrency, {
          normal: claimCost,
          reverse: {
            claim: claimCost,
            lockup: this.calculateTokenGasCosts(
              rate,
              relativeFee,
              FeeProvider.gasUsage.ERC20Swap.lockup,
            )
          }
        });
        break;
      }
    }
  }

  private calculateTokenGasCosts = (rate: number, gasPrice: number, gasUsage: number) => {
    return Math.ceil(rate * this.calculateEtherGasCost(gasPrice, gasUsage));
  }

  private calculateEtherGasCost = (gasPrice: number, gasUsage: number) => {
    return BigNumber.from(gasPrice).mul(gweiDecimals).mul(gasUsage).div(etherDecimals).toNumber();
  }
}

export default FeeProvider;
export { ReverseMinerFees, MinerFees };
