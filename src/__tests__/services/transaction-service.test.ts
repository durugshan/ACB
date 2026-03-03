import fs from 'fs';
import * as XLSX from 'xlsx';
import { TransactionService } from '../../services/transaction-service';
import { Transaction, AnnualSummary } from '../../types';

// Mock fs and XLSX modules
jest.mock('fs');
jest.mock('xlsx');

// Mock csv-writer
const mockWriteRecordsCalls: any[] = [];
jest.mock('csv-writer', () => ({
    createObjectCsvWriter: () => ({
        writeRecords: (records: any[]) => {
            mockWriteRecordsCalls.push(records);
            return Promise.resolve();
        }
    })
}));

describe('TransactionService', () => {
    const mockVestData = `File Name,Release Date,Shares Released,Market Value Per Share,Shares Sold,Is ESPP
11-20-2022_0.pdf,11-20-2022,100.0000,50.000000,40.0000,false
02-20-2023_1.pdf,02-20-2023,100.0000,60.000000,40.0000,false`;

    const mockVestDataWithESPP = `File Name,Release Date,Shares Released,Market Value Per Share,Shares Sold,Is ESPP
11-20-2022_0.pdf,11-20-2022,100.0000,50.000000,40.0000,false
02-20-2023_1.pdf,02-20-2023,100.0000,60.000000,40.0000,false
getEsppConfirmation.pdf,05-15-2024,427.0000,71.520000,0,true`;

    const mock2024VestData = `File Name,Release Date,Shares Released,Market Value Per Share,Shares Sold,Is ESPP
03-15-2024_0.pdf,03-15-2024,100.0000,50.000000,40.0000,false
08-20-2024_1.pdf,08-20-2024,100.0000,60.000000,40.0000,false`;

    const mockSellData = [
        {
            'Record Type': 'Sell',
            'Date Sold': '11/21/2022',
            'Qty.': 40,
            'Proceeds Per Share': 55.00,
            'Total Proceeds': 2200.00
        },
        {
            'Record Type': 'Sell',
            'Date Sold': '02/21/2023',
            'Qty.': 40,
            'Proceeds Per Share': 65.00,
            'Total Proceeds': 2600.00
        }
    ];

    const mock2024SellData = [
        {
            'Record Type': 'Sell',
            'Date Sold': '04/15/2024',
            'Qty.': 40,
            'Proceeds Per Share': 55.00,
            'Total Proceeds': 2200.00
        },
        {
            'Record Type': 'Sell',
            'Date Sold': '09/21/2024',
            'Qty.': 40,
            'Proceeds Per Share': 65.00,
            'Total Proceeds': 2600.00
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        mockWriteRecordsCalls.length = 0;

        // Setup mock data
        (fs.readFileSync as jest.Mock).mockReturnValue(mockVestData);
        (XLSX.readFile as jest.Mock).mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: { Sheet1: {} }
        });
        (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(mockSellData);
    });

    describe('processTransactions', () => {
        it('should process transactions and calculate ACB correctly', async () => {
            const service = new TransactionService(true); // Use mock exchange rates
            await service.processTransactions();

            // Get transactions from the mock write calls
            const transactions = mockWriteRecordsCalls[0] as Transaction[];

            // Verify basic transaction count
            expect(transactions.length).toBe(4); // 2 vests + 2 sells

            // Test first vest transaction
            const firstVest = transactions[0];
            expect(firstVest.Transaction_Type).toBe('VEST');
            expect(firstVest.Shares).toBe(100);
            expect(firstVest.Price_Per_Share.value).toBe(50);
            expect(firstVest.Total_Value.value).toBe(5000); // 100 shares * $50
            expect(firstVest.Running_Share_Balance).toBe(100);
            expect(firstVest.Running_ACB.value).toBe(5000);
            expect(firstVest.ACB_Per_Share.value).toBe(50);
            expect(firstVest.Is_ESPP).toBe(false);

            // Test first sell transaction
            const firstSell = transactions[1];
            expect(firstSell.Transaction_Type).toBe('SELL');
            expect(firstSell.Shares).toBe(-40);
            expect(firstSell.Price_Per_Share.value).toBe(55);
            expect(firstSell.Running_Share_Balance).toBe(60);
            expect(firstSell.Running_ACB.value).toBe(3000); // 5000 - (50 * 40)
            expect(firstSell.ACB_Per_Share.value).toBe(50);
            expect(firstSell.Capital_Gain_Loss?.value).toBe(200); // (55 - 50) * 40
            expect(firstSell.Is_ESPP).toBe(false);

            // Test second vest transaction
            const secondVest = transactions[2];
            expect(secondVest.Transaction_Type).toBe('VEST');
            expect(secondVest.Shares).toBe(100);
            expect(secondVest.Price_Per_Share.value).toBe(60);
            expect(secondVest.Total_Value.value).toBe(6000); // 100 shares * $60
            expect(secondVest.Running_Share_Balance).toBe(160);
            expect(secondVest.Running_ACB.value).toBe(9000); // 3000 + (60 * 100)
            expect(secondVest.ACB_Per_Share.value).toBe(56.25); // 9000 / 160
            expect(secondVest.Is_ESPP).toBe(false);

            // Test second sell transaction
            const secondSell = transactions[3];
            expect(secondSell.Transaction_Type).toBe('SELL');
            expect(secondSell.Shares).toBe(-40);
            expect(secondSell.Price_Per_Share.value).toBe(65);
            expect(secondSell.Running_Share_Balance).toBe(120);
            expect(secondSell.Running_ACB.value).toBe(6750); // 9000 - (56.25 * 40)
            expect(secondSell.ACB_Per_Share.value).toBe(56.25);
            expect(secondSell.Capital_Gain_Loss?.value).toBe(350); // (65 - 56.25) * 40
            expect(secondSell.Is_ESPP).toBe(false);

            // Verify annual summary
            const summary = mockWriteRecordsCalls[1] as AnnualSummary[];
            expect(summary.length).toBe(2); // 2 years

            // Test 2022 summary
            const year2022 = summary[0];
            expect(year2022.Year).toBe(2022);
            expect(year2022.Total_Vested).toBe(100);
            expect(year2022.Total_Sold).toBe(40);
            expect(year2022.Total_Proceeds.value).toBe(2200); // 40 shares * $55
            expect(year2022.Total_Cost_Base.value).toBe(2000); // 40 shares * $50 (ACB per share at time of sale)
            expect(year2022.Net_Capital_Gain_Loss.value).toBe(200); // 2200 - 2000
            expect(year2022.Total_Proceeds_CAD.value).toBe(2959.60); // 40 shares * $55 * 1.3452
            expect(year2022.Total_Cost_Base_CAD.value).toBe(2690.40); // 40 shares * $50 * 1.3452
            expect(year2022.Net_Capital_Gain_Loss_CAD.value).toBe(269.04); // USD gain/loss ($200) * 1.3452

            // Test 2023 summary
            const year2023 = summary[1];
            expect(year2023.Year).toBe(2023);
            expect(year2023.Total_Vested).toBe(100);
            expect(year2023.Total_Sold).toBe(40);
            expect(year2023.Total_Proceeds.value).toBe(2600); // 40 shares * $65
            expect(year2023.Total_Cost_Base.value).toBe(2250); // 40 shares * $56.25 (ACB per share at time of sale)
            expect(year2023.Net_Capital_Gain_Loss.value).toBe(350); // 2600 - 2250
            expect(year2023.Total_Proceeds_CAD.value).toBe(3514.00); // 40 shares * $65 * 1.3516
            expect(year2023.Total_Cost_Base_CAD.value).toBe(3041.20); // 40 shares * $56.25 * 1.3516
            expect(year2023.Net_Capital_Gain_Loss_CAD.value).toBe(473.06); // USD gain/loss ($350) * 1.3516

            // Verify USD gain/loss calculations
            expect(year2022.Total_Proceeds.value - year2022.Total_Cost_Base.value)
                .toBe(year2022.Net_Capital_Gain_Loss.value);
            expect(year2023.Total_Proceeds.value - year2023.Total_Cost_Base.value)
                .toBe(year2023.Net_Capital_Gain_Loss.value);

            // Verify CAD gain/loss is calculated by converting USD gain/loss
            expect(year2022.Net_Capital_Gain_Loss_CAD.value)
                .toBe(Number((year2022.Net_Capital_Gain_Loss.value * 1.3452).toFixed(2)));
            expect(year2023.Net_Capital_Gain_Loss_CAD.value)
                .toBe(Number((year2023.Net_Capital_Gain_Loss.value * 1.3516).toFixed(2)));
        });

        it('should process 2024 transactions with period splitting', async () => {
            // Setup 2024 data
            (fs.readFileSync as jest.Mock).mockReturnValue(mock2024VestData);
            (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(mock2024SellData);

            const service = new TransactionService(true);
            await service.processTransactions();

            // Verify annual summary
            const summary = mockWriteRecordsCalls[1] as AnnualSummary[];
            expect(summary.length).toBe(3); // 2024-H1, 2024-H2, 2024

            // Test first half 2024
            const firstHalf = summary[0];
            expect(firstHalf.Year).toBe('2024-H1');
            expect(firstHalf.Total_Vested).toBe(100); // March vest
            expect(firstHalf.Total_Sold).toBe(40);    // April sell
            expect(firstHalf.Period_End_Shares).toBe(60); // 100 - 40

            // Test second half 2024
            const secondHalf = summary[1];
            expect(secondHalf.Year).toBe('2024-H2');
            expect(secondHalf.Total_Vested).toBe(100); // August vest
            expect(secondHalf.Total_Sold).toBe(40);    // September sell
            expect(secondHalf.Period_End_Shares).toBe(120); // Previous 60 + 100 - 40

            // Test full year 2024
            const fullYear = summary[2];
            expect(fullYear.Year).toBe('2024');
            expect(fullYear.Total_Vested).toBe(200); // Both vests
            expect(fullYear.Total_Sold).toBe(80);    // Both sells
            expect(fullYear.Period_End_Shares).toBe(120); // Final balance

            // Verify each period is calculated independently
            expect(firstHalf.Total_Proceeds.value).toBe(2200);  // First sell only
            expect(secondHalf.Total_Proceeds.value).toBe(2600); // Second sell only
            expect(fullYear.Total_Proceeds.value).toBe(4800);   // Both sells
        });

        it('should handle empty data', async () => {
            // Mock empty data
            (fs.readFileSync as jest.Mock).mockReturnValue('File Name,Release Date,Shares Released,Market Value Per Share,Shares Sold,Is ESPP\n');
            (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([]);

            const service = new TransactionService(true);
            await service.processTransactions();

            expect(mockWriteRecordsCalls.length).toBe(2);
            expect(mockWriteRecordsCalls[0].length).toBe(0); // No transactions
            expect(mockWriteRecordsCalls[1].length).toBe(0); // No summary
        });

        it('should identify potential sell-to-cover transactions', async () => {
            const service = new TransactionService(true);
            await service.processTransactions();

            const transactions = mockWriteRecordsCalls[0] as Transaction[];
            const sellTransactions = transactions.filter(t => t.Transaction_Type === 'SELL');

            sellTransactions.forEach(sell => {
                expect(sell.Potential_Sell_To_Cover).toBe(true);
            });
        });

        it('should process ESPP transactions correctly', async () => {
            // Setup mock data with ESPP transaction
            (fs.readFileSync as jest.Mock).mockReturnValue(mockVestDataWithESPP);

            const service = new TransactionService(true);
            await service.processTransactions();

            const transactions = mockWriteRecordsCalls[0] as Transaction[];

            // Find the ESPP transaction
            const esppTransaction = transactions.find(t => t.Is_ESPP);
            expect(esppTransaction).toBeDefined();
            expect(esppTransaction?.Transaction_Type).toBe('VEST');
            expect(esppTransaction?.Shares).toBe(427);
            expect(esppTransaction?.Price_Per_Share.value).toBe(71.52);
            expect(esppTransaction?.Total_Value.value).toBe(30539.04); // 427 * 71.52

            // Verify annual summary for ESPP year
            const summary = mockWriteRecordsCalls[1] as AnnualSummary[];
            console.log(summary, 'summary');
            const year2024 = summary.find((s: AnnualSummary) => s.Year === '2024');
            expect(year2024).toBeDefined();
            expect(year2024?.Total_Vested).toBe(427);
            expect(year2024?.Total_Sold).toBe(0);
            expect(year2024?.Total_Proceeds.value).toBe(0); // No sales, so no proceeds
            expect(year2024?.Total_Cost_Base.value).toBe(0); // No sales, so no cost base to report
            expect(year2024?.Net_Capital_Gain_Loss.value).toBe(0); // No sales, so no gain/loss
            expect(year2024?.Total_Proceeds_CAD.value).toBe(0);
            expect(year2024?.Total_Cost_Base_CAD.value).toBe(0);
            expect(year2024?.Net_Capital_Gain_Loss_CAD.value).toBe(0);
        });

        it('should format all monetary values with 2 decimal places', async () => {
            const service = new TransactionService(true);
            await service.processTransactions();

            const summary = mockWriteRecordsCalls[1] as AnnualSummary[];

            // Test all monetary values in the summary
            summary.forEach((year: AnnualSummary) => {
                // Test CAD values
                expect(year.Total_Proceeds_CAD.toString()).toMatch(/^\d+\.\d{2}$/);
                expect(year.Total_Cost_Base_CAD.toString()).toMatch(/^\d+\.\d{2}$/);
                expect(year.Net_Capital_Gain_Loss_CAD.toString()).toMatch(/^\d+\.\d{2}$/);
            });
        });
    });
});