import { Transaction, SuperficialLossResult } from '../types';

export class SuperficialLossService {
    /**
     * Calculate superficial loss according to CRA rules.
     * When a superficial loss occurs:
     * 1. The capital loss is denied
     * 2. The denied loss is added to the ACB immediately after the sale
     * 
     * A superficial loss occurs when:
     * 1. You sell an investment at a loss AND
     * 2. You buy the same investment within 30 days before or after the sale AND
     * 3. You still own the investment at the end of the 30 day period
     */
    calculateSuperficialLoss(
        transaction: Transaction,
        allTransactions: Transaction[],
        gainLoss: number
    ): SuperficialLossResult {
        // If not a sell transaction or selling at a gain, no superficial loss
        if (
            transaction.Transaction_Type !== 'SELL' ||
            gainLoss >= 0
        ) {
            return {
                superficialLossShares: 0,
                deniedLoss: 0
            };
        }

        // Create dates without time components to avoid timezone issues
        const saleDate = new Date(transaction.Date);
        const saleDay = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
        const periodStart = new Date(saleDay);
        const periodEnd = new Date(saleDay);
        periodStart.setDate(periodStart.getDate() - 30);
        periodEnd.setDate(periodEnd.getDate() + 30);

        // S = number of shares sold (absolute value since sells are negative)
        const S = Math.abs(transaction.Shares);

        // P = total shares acquired in 61-day period
        const P = this.calculateSharesAcquired(allTransactions, periodStart, periodEnd);

        // B = shares remaining at end of period
        const B = this.calculateRemainingShares(allTransactions, periodEnd);

        // Calculate superficial loss shares using the formula
        const superficialLossShares = Math.min(S, P, B);

        // Calculate the denied loss
        const totalLoss = Math.abs(gainLoss);
        const superficialLossRatio = superficialLossShares / S;
        const deniedLoss = totalLoss * superficialLossRatio;

        return {
            superficialLossShares,
            deniedLoss
        };
    }

    private calculateSharesAcquired(
        transactions: Transaction[],
        startDate: Date,
        endDate: Date
    ): number {
        return transactions
            .filter(t => {
                const date = new Date(t.Date);
                const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                return (
                    t.Transaction_Type === 'VEST' &&
                    day >= startDate &&
                    day <= endDate
                );
            })
            .reduce((sum, t) => sum + t.Shares, 0);
    }

    private calculateRemainingShares(
        transactions: Transaction[],
        endDate: Date
    ): number {
        let runningShares = 0;
        for (const t of transactions) {
            const date = new Date(t.Date);
            const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            if (day <= endDate) {
                if (t.Transaction_Type === 'VEST') {
                    runningShares += t.Shares;
                } else if (t.Transaction_Type === 'SELL') {
                    runningShares += t.Shares; // Sells are already negative
                }
            }
        }
        return Math.max(0, runningShares); // Can't have negative shares remaining
    }
}