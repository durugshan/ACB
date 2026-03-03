import { SuperficialLossService } from '../../services/superficial-loss-service';
import { Transaction } from '../../types';
import { createMonetaryValue } from '../../utils';

describe('SuperficialLossService', () => {
    let service: SuperficialLossService;

    beforeEach(() => {
        service = new SuperficialLossService();
    });

    interface CreateTransactionParams {
        type: 'VEST' | 'SELL';
        date: string;
        shares: number;
        pricePerShare: number;
        isEspp?: boolean;
    }

    function createTransaction({
        type,
        date,
        shares,
        pricePerShare,
        isEspp = false
    }: CreateTransactionParams): Transaction {
        const mockExchangeRate = 1.3; // Mock CAD/USD rate
        return {
            Date: date,
            Transaction_Type: type,
            Shares: shares,
            Exchange_Rate: mockExchangeRate,
            Price_Per_Share: createMonetaryValue(pricePerShare),
            Price_Per_Share_CAD: createMonetaryValue(pricePerShare * mockExchangeRate),
            Total_Value: createMonetaryValue(shares * pricePerShare),
            Total_Value_CAD: createMonetaryValue(shares * pricePerShare * mockExchangeRate),
            Year: new Date(date).getFullYear(),
            Running_Share_Balance: shares,
            Running_ACB: createMonetaryValue(shares * pricePerShare),
            Running_ACB_CAD: createMonetaryValue(shares * pricePerShare * mockExchangeRate),
            ACB_Per_Share: createMonetaryValue(pricePerShare),
            ACB_Per_Share_CAD: createMonetaryValue(pricePerShare * mockExchangeRate),
            Is_ESPP: isEspp
        };
    }

    describe('calculateSuperficialLoss', () => {
        it('should return 0 superficial loss shares for VEST transactions', () => {
            const transaction = createTransaction({
                type: 'VEST',
                date: '2023-01-01',
                shares: 100,
                pricePerShare: 50
            });
            const result = service.calculateSuperficialLoss(transaction, [transaction], 0);

            expect(result.superficialLossShares).toBe(0);
            expect(result.deniedLoss).toBe(0);
        });

        it('should return 0 superficial loss shares for SELL transactions with gain', () => {
            const transaction = createTransaction({
                type: 'SELL',
                date: '2023-01-01',
                shares: -100,
                pricePerShare: 60
            });
            const result = service.calculateSuperficialLoss(transaction, [transaction], 1000);

            expect(result.superficialLossShares).toBe(0);
            expect(result.deniedLoss).toBe(0);
        });

        it('should calculate superficial loss shares when shares are acquired in period', () => {
            const transactions = [
                createTransaction({
                    type: 'VEST',
                    date: '2023-01-15',
                    shares: 100,
                    pricePerShare: 50
                }),
                createTransaction({
                    type: 'SELL',
                    date: '2023-02-01',
                    shares: -100,
                    pricePerShare: 40
                }),
                createTransaction({
                    type: 'VEST',
                    date: '2023-02-15',
                    shares: 50,
                    pricePerShare: 45
                })
            ];

            const result = service.calculateSuperficialLoss(transactions[1], transactions, -1000);

            expect(result.superficialLossShares).toBe(50);
            // Half of loss should be denied
            expect(result.deniedLoss).toBe(500);
        });

        it('should consider shares remaining at end of period', () => {
            const transactions = [
                createTransaction({
                    type: 'VEST',
                    date: '2023-01-01',
                    shares: 100,
                    pricePerShare: 50
                }),
                createTransaction({
                    type: 'SELL',
                    date: '2023-02-01',
                    shares: -80,
                    pricePerShare: 40
                }),
                createTransaction({
                    type: 'VEST',
                    date: '2023-02-15',
                    shares: 50,
                    pricePerShare: 45
                }),
                createTransaction({
                    type: 'SELL',
                    date: '2023-02-16',
                    shares: -60,
                    pricePerShare: 45
                })
            ];

            const result = service.calculateSuperficialLoss(transactions[1], transactions, -800);

            // 10 shares remain at end of period
            expect(result.superficialLossShares).toBe(10);
            // 1/8 of loss should be denied
            expect(result.deniedLoss).toBe(100);
        });

        it('should handle multiple acquisitions in period', () => {
            const transactions = [
                createTransaction({
                    type: 'VEST',
                    date: '2023-01-01',
                    shares: 100,
                    pricePerShare: 50
                }),
                createTransaction({
                    type: 'SELL',
                    date: '2023-02-01',
                    shares: -100,
                    pricePerShare: 40
                }),
                createTransaction({
                    type: 'VEST',
                    date: '2023-02-15',
                    shares: 30,
                    pricePerShare: 45
                }),
                createTransaction({
                    type: 'VEST',
                    date: '2023-02-20',
                    shares: 20,
                    pricePerShare: 45
                })
            ];

            const result = service.calculateSuperficialLoss(transactions[1], transactions, -1000);

            expect(result.superficialLossShares).toBe(50);
            expect(result.deniedLoss).toBe(500);
        });

        it('should not consider acquisitions outside period', () => {
            const transactions = [
                createTransaction({
                    type: 'VEST',
                    date: '2023-01-01',
                    shares: 100,
                    pricePerShare: 50
                }),
                createTransaction({
                    type: 'SELL',
                    date: '2023-02-01',
                    shares: -100,
                    pricePerShare: 40
                }),
                createTransaction({
                    type: 'VEST',
                    date: '2023-03-15',
                    shares: 50,
                    pricePerShare: 45
                }) // Outside 30-day window
            ];

            const result = service.calculateSuperficialLoss(transactions[1], transactions, -1000);

            expect(result.superficialLossShares).toBe(0);
            expect(result.deniedLoss).toBe(0);
        });

        it('should handle ESPP transactions the same way as RSU transactions', () => {
            const transactions = [
                createTransaction({
                    type: 'VEST',
                    date: '2023-01-01',
                    shares: 100,
                    pricePerShare: 50,
                    isEspp: true
                }),
                createTransaction({
                    type: 'SELL',
                    date: '2023-02-01',
                    shares: -100,
                    pricePerShare: 40
                }),
                createTransaction({
                    type: 'VEST',
                    date: '2023-02-15',
                    shares: 50,
                    pricePerShare: 45,
                    isEspp: true
                })
            ];

            const result = service.calculateSuperficialLoss(transactions[1], transactions, -1000);

            expect(result.superficialLossShares).toBe(50);
            expect(result.deniedLoss).toBe(500);
        });

        // New test cases for complete disposition scenario
        it('should not mark as superficial loss when all shares are sold within 30 days', () => {
            const transactions = [
                // Initial vest of 1000 shares
                createTransaction({
                    type: 'VEST',
                    date: '2023-11-20',
                    shares: 1000,
                    pricePerShare: 100
                }),
                // New vest of 100 shares
                createTransaction({
                    type: 'VEST',
                    date: '2024-02-20',
                    shares: 100,
                    pricePerShare: 100
                }),
                // Sell 40 shares at loss
                createTransaction({
                    type: 'SELL',
                    date: '2024-02-21',
                    shares: -40,
                    pricePerShare: 90
                }),
                // Sell all remaining shares at loss
                createTransaction({
                    type: 'SELL',
                    date: '2024-02-26',
                    shares: -1060,
                    pricePerShare: 90
                })
            ];

            // Test Feb 21 sell-to-cover
            const feb21Sale = transactions[2];
            const result1 = service.calculateSuperficialLoss(feb21Sale, transactions, -400);

            // Should not be a superficial loss because no shares remain after 30 days
            expect(result1.superficialLossShares).toBe(0);
            expect(result1.deniedLoss).toBe(0);

            // Test Feb 26 complete sale
            const feb26Sale = transactions[3];
            const result2 = service.calculateSuperficialLoss(feb26Sale, transactions, -10600);

            // Should not be a superficial loss because no shares remain after sale
            expect(result2.superficialLossShares).toBe(0);
            expect(result2.deniedLoss).toBe(0);
        });
    });
});