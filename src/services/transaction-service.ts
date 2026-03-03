import fs from 'fs';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import { Transaction, RawTransaction, SellRecord, AnnualSummary } from '../types';
import { parseDate, formatDate, createMonetaryValue } from '../utils';
import { SuperficialLossService } from './superficial-loss-service';
import { ExchangeRateService } from './exchange-rate-service';

interface TempTransaction {
    Date: string;
    Transaction_Type: 'VEST' | 'SELL';
    Shares: number;
    Price_Per_Share: number;
    Total_Value: number;
    Year: number;
    Is_ESPP: boolean;
}

export class TransactionService {
    private superficialLossService: SuperficialLossService;
    private exchangeRateService: ExchangeRateService;
    private csvWriter = createObjectCsvWriter({
        path: 'acb_transactions.csv',
        header: [
            { id: 'Date', title: 'Date' },
            { id: 'Transaction_Type', title: 'Type' },
            { id: 'Shares', title: 'Shares' },
            { id: 'Price_Per_Share', title: 'Price/Share (USD)' },
            { id: 'Exchange_Rate', title: 'Exchange Rate' },
            { id: 'Price_Per_Share_CAD', title: 'Price/Share (CAD)' },
            { id: 'Total_Value', title: 'Total Value (USD)' },
            { id: 'Total_Value_CAD', title: 'Total Value (CAD)' },
            { id: 'Running_Share_Balance', title: 'Share Balance' },
            { id: 'Running_ACB', title: 'Running ACB (USD)' },
            { id: 'Running_ACB_CAD', title: 'Running ACB (CAD)' },
            { id: 'ACB_Per_Share', title: 'ACB/Share (USD)' },
            { id: 'ACB_Per_Share_CAD', title: 'ACB/Share (CAD)' },
            { id: 'Capital_Gain_Loss', title: 'Capital Gain/Loss (USD)' },
            { id: 'Capital_Gain_Loss_CAD', title: 'Capital Gain/Loss (CAD)' },
            { id: 'Superficial_Loss_Shares', title: 'Superficial Loss Shares' },
            { id: 'Potential_Sell_To_Cover', title: 'Potential Sell-to-Cover?' },
            { id: 'Is_ESPP', title: 'Is ESPP?' }
        ]
    });

    private summaryWriter = createObjectCsvWriter({
        path: 'annual_summary.csv',
        header: [
            { id: 'Year', title: 'Year' },
            { id: 'Total_Vested', title: 'Total Shares Vested' },
            { id: 'Total_Sold', title: 'Total Shares Sold' },
            { id: 'Total_Proceeds', title: 'Total Proceeds (USD)' },
            { id: 'Total_Proceeds_CAD', title: 'Total Proceeds (CAD)' },
            { id: 'Total_Cost_Base', title: 'Total Cost Base (USD)' },
            { id: 'Total_Cost_Base_CAD', title: 'Total Cost Base (CAD)' },
            { id: 'Net_Capital_Gain_Loss', title: 'Net Capital Gain/Loss (USD)' },
            { id: 'Net_Capital_Gain_Loss_CAD', title: 'Net Capital Gain/Loss (CAD)' },
            { id: 'Period_End_Shares', title: 'Period End Shares' },
            { id: 'Period_End_ACB', title: 'Period End ACB (USD)' },
            { id: 'Period_End_ACB_CAD', title: 'Period End ACB (CAD)' },
            { id: 'Period_End_ACB_Per_Share', title: 'Period End ACB/Share (USD)' },
            { id: 'Period_End_ACB_Per_Share_CAD', title: 'Period End ACB/Share (CAD)' }
        ]
    });

    constructor(useMockExchangeRate: boolean = false) {
        this.superficialLossService = new SuperficialLossService();
        this.exchangeRateService = ExchangeRateService.getInstance(useMockExchangeRate);
    }

    async processTransactions(): Promise<void> {
        // Read vest data from CSV
        const vestData = fs.readFileSync('share_data.csv', 'utf-8');
        const vestTransactions = this.processVestData(vestData);
        console.log(`Found ${vestTransactions.length} vest transactions`);

        // Read sell data from Excel
        const workbook = XLSX.readFile('G&L_Expanded.xlsx');
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const sellData = XLSX.utils.sheet_to_json<SellRecord>(worksheet);
        const sellTransactions = this.processSellData(sellData);
        console.log(`Found ${sellTransactions.length} sell transactions`);

        // Initialize exchange rates
        const allTransactions = [...vestTransactions, ...sellTransactions];
        await this.exchangeRateService.initializeRates(allTransactions);
        console.log('Exchange rates initialized');

        // Process all transactions
        const processedTransactions = await this.processAllTransactions(allTransactions);

        // Generate and write reports
        const annualSummary = this.generateAnnualSummary(processedTransactions);
        await this.writeReports(processedTransactions, annualSummary);
        console.log(`Generated reports with ${annualSummary.length} periods`);
    }

    private processVestData(vestData: string): RawTransaction[] {
        const vestRows = vestData.split('\n').slice(1); // Skip header

        const results: RawTransaction[] = [];

        for (const row of vestRows) {
            if (!row.trim()) continue;

            const [fileName, releaseDate, sharesReleased, marketValue, sharesSold, isESPP] = row.split(',');

            if (!releaseDate || !sharesReleased || !marketValue) {
                console.warn(`Skipping incomplete row: ${row}`);
                continue;
            }

            try {
                const date = parseDate(releaseDate);
                const shares = Number(sharesReleased);
                const pricePerShare = Number(marketValue);
                const isEsppValue = isESPP?.trim().toLowerCase() === 'true';

                results.push({
                    Date: formatDate(date),
                    Transaction_Type: 'VEST',
                    Shares: shares,
                    Price_Per_Share: pricePerShare,
                    Total_Value: shares * pricePerShare,
                    Year: date.getFullYear(),
                    Is_ESPP: isEsppValue
                });
            } catch (error) {
                console.error(`Error processing row: ${row}`, error);
            }
        }

        return results;
    }

    private processSellData(sellData: SellRecord[]): RawTransaction[] {
        return sellData
            .filter(record => record['Record Type'] === 'Sell' && record['Date Sold'])
            .map(record => {
                const date = parseDate(record['Date Sold']);
                const shares = -record['Qty.'];
                const pricePerShare = record['Proceeds Per Share'];

                return {
                    Date: formatDate(date),
                    Transaction_Type: 'SELL',
                    Shares: shares,
                    Price_Per_Share: pricePerShare,
                    Total_Value: -shares * pricePerShare,
                    Year: date.getFullYear(),
                    Is_ESPP: false // Sell records don't indicate if they're ESPP or not
                };
            });
    }

    private async processAllTransactions(rawTransactions: RawTransaction[]): Promise<Transaction[]> {
        const transactions: Transaction[] = [];
        let runningShares = 0;
        let runningACBUSD = 0;

        // Sort transactions by date
        rawTransactions.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
        console.log('Processing transactions chronologically...');

        for (const rawTx of rawTransactions) {
            const exchangeRate = this.exchangeRateService.getExchangeRate(rawTx.Date);

            // Calculate ACB per share before any changes
            const acbPerShare = runningShares > 0 ? runningACBUSD / runningShares : 0;

            // Initialize transaction with common fields
            const tx: Transaction = {
                ...rawTx,
                Exchange_Rate: exchangeRate,
                Price_Per_Share: createMonetaryValue(rawTx.Price_Per_Share),
                Price_Per_Share_CAD: createMonetaryValue(rawTx.Price_Per_Share * exchangeRate),
                Total_Value: createMonetaryValue(rawTx.Total_Value),
                Total_Value_CAD: createMonetaryValue(rawTx.Total_Value * exchangeRate),
                Running_Share_Balance: 0,  // Will be set below
                Running_ACB: createMonetaryValue(0),  // Will be set below
                Running_ACB_CAD: createMonetaryValue(0),  // Will be set below
                ACB_Per_Share: createMonetaryValue(0),  // Will be set below
                ACB_Per_Share_CAD: createMonetaryValue(0),  // Will be set below
                Is_ESPP: rawTx.Is_ESPP || false
            };

            // Update running totals
            if (tx.Transaction_Type === 'VEST') {
                // For vest (buy) transactions:
                // New Total ACB = Previous Total ACB + (Share Price × Number of Shares Purchased)
                runningACBUSD = runningACBUSD + (tx.Price_Per_Share.value * tx.Shares);
                runningShares += tx.Shares;
            } else {
                // For sell transactions:
                // Calculate capital gain/loss before updating ACB
                const gainLoss = (tx.Price_Per_Share.value - acbPerShare) * Math.abs(tx.Shares);
                tx.Capital_Gain_Loss = createMonetaryValue(gainLoss);
                tx.Capital_Gain_Loss_CAD = createMonetaryValue(gainLoss * exchangeRate);

                // Update ACB:
                // 1. First subtract ACB for sold shares
                runningACBUSD = runningACBUSD - (acbPerShare * Math.abs(tx.Shares));
                runningShares += tx.Shares; // This adds a negative number

                // 2. Check for superficial loss and add denied loss to ACB if needed
                if (gainLoss < 0) {
                    const { superficialLossShares, deniedLoss } =
                        this.superficialLossService.calculateSuperficialLoss(tx, transactions, gainLoss);

                    if (superficialLossShares > 0) {
                        tx.Superficial_Loss_Shares = superficialLossShares;
                        runningACBUSD += deniedLoss;
                    }
                }
            }

            // Update running totals in transaction
            tx.Running_Share_Balance = runningShares;
            tx.Running_ACB = createMonetaryValue(runningACBUSD);
            tx.Running_ACB_CAD = createMonetaryValue(runningACBUSD * exchangeRate);
            tx.ACB_Per_Share = createMonetaryValue(runningShares > 0 ? runningACBUSD / runningShares : 0);
            tx.ACB_Per_Share_CAD = createMonetaryValue(tx.ACB_Per_Share.value * exchangeRate);

            // Check for potential sell-to-cover
            if (tx.Transaction_Type === 'SELL') {
                tx.Potential_Sell_To_Cover = this.isPotentialSellToCover(tx, transactions);
            }

            transactions.push(tx);
        }

        console.log(`Final share balance: ${runningShares}`);
        return transactions;
    }

    private isPotentialSellToCover(sellTransaction: Transaction, allTransactions: Transaction[]): boolean {
        const sellDate = new Date(sellTransaction.Date);

        // Look for vests within 2 calendar days before this sell
        return allTransactions.some(t => {
            if (t.Transaction_Type !== 'VEST') return false;

            const vestDate = new Date(t.Date);
            // Get dates without time components for calendar day comparison
            const vestDay = new Date(vestDate.getFullYear(), vestDate.getMonth(), vestDate.getDate());
            const sellDay = new Date(sellDate.getFullYear(), sellDate.getMonth(), sellDate.getDate());

            // Calculate difference in calendar days
            const daysDiff = Math.floor((sellDay.getTime() - vestDay.getTime()) / (24 * 60 * 60 * 1000));

            return daysDiff >= 0 && daysDiff <= 2;
        });
    }

    private generateAnnualSummary(transactions: Transaction[]): AnnualSummary[] {
        const generatePeriodData = (periodTransactions: Transaction[]) => {
            const data = {
                vested: 0,
                sold: 0,
                proceedsUSD: 0,
                proceedsCAD: 0,
                costBaseUSD: 0,
                costBaseCAD: 0,
                gainLossUSD: 0,
                gainLossCAD: 0,
                lastTransaction: periodTransactions[periodTransactions.length - 1]
            };

            for (const tx of periodTransactions) {
                if (tx.Transaction_Type === 'VEST') {
                    data.vested += tx.Shares;
                } else { // SELL transaction
                    const sharesSold = Math.abs(tx.Shares);
                    data.sold += sharesSold;

                    // Calculate proceeds
                    const proceedsUSD = sharesSold * tx.Price_Per_Share.value;
                    const proceedsCAD = sharesSold * tx.Price_Per_Share_CAD.value;
                    data.proceedsUSD += proceedsUSD;
                    data.proceedsCAD += proceedsCAD;

                    // Calculate cost base
                    const costBaseUSD = sharesSold * tx.ACB_Per_Share.value;
                    const costBaseCAD = sharesSold * tx.ACB_Per_Share_CAD.value;
                    data.costBaseUSD += costBaseUSD;
                    data.costBaseCAD += costBaseCAD;

                    // Add to gain/loss totals
                    data.gainLossUSD += tx.Capital_Gain_Loss?.value || 0;
                    data.gainLossCAD += tx.Capital_Gain_Loss_CAD?.value || 0;
                }
            }

            return {
                Total_Vested: data.vested,
                Total_Sold: data.sold,
                Total_Proceeds: createMonetaryValue(data.proceedsUSD),
                Total_Proceeds_CAD: createMonetaryValue(data.proceedsCAD),
                Total_Cost_Base: createMonetaryValue(data.costBaseUSD),
                Total_Cost_Base_CAD: createMonetaryValue(data.costBaseCAD),
                Net_Capital_Gain_Loss: createMonetaryValue(data.gainLossUSD),
                Net_Capital_Gain_Loss_CAD: createMonetaryValue(data.gainLossCAD),
                Period_End_Shares: data.lastTransaction.Running_Share_Balance,
                Period_End_ACB: data.lastTransaction.Running_ACB,
                Period_End_ACB_CAD: data.lastTransaction.Running_ACB_CAD,
                Period_End_ACB_Per_Share: data.lastTransaction.ACB_Per_Share,
                Period_End_ACB_Per_Share_CAD: data.lastTransaction.ACB_Per_Share_CAD
            };
        };

        // Group transactions by year
        const yearMap = new Map<number, Transaction[]>();
        for (const tx of transactions) {
            const year = tx.Year;
            if (!yearMap.has(year)) {
                yearMap.set(year, []);
            }
            yearMap.get(year)!.push(tx);
        }

        // Generate summaries for each year/period
        const summaries: AnnualSummary[] = [];
        const years = Array.from(yearMap.keys()).sort();

        for (const year of years) {
            const yearTransactions = yearMap.get(year)!;

            if (year === 2024) {
                // Get only 2024-H1 transactions (Jan 1 - Jun 24)
                const h1Transactions = yearTransactions.filter(tx =>
                    new Date(tx.Date) <= new Date('2024-06-24')
                );

                // Get only 2024-H2 transactions (Jun 25 - Dec 31)
                const h2Transactions = yearTransactions.filter(tx =>
                    new Date(tx.Date) >= new Date('2024-06-25')
                );

                // Add 2024-H1 summary
                if (h1Transactions.length > 0) {
                    summaries.push({
                        Year: '2024-H1',
                        ...generatePeriodData(h1Transactions)
                    });
                }

                // Add 2024-H2 summary
                if (h2Transactions.length > 0) {
                    summaries.push({
                        Year: '2024-H2',
                        ...generatePeriodData(h2Transactions)
                    });
                }

                // Add 2024 full year summary
                if (yearTransactions.length > 0) {
                    summaries.push({
                        Year: '2024',
                        ...generatePeriodData(yearTransactions)
                    });
                }
            } else {
                // For non-2024 years, just use that year's transactions
                summaries.push({
                    Year: year,
                    ...generatePeriodData(yearTransactions)
                });
            }
        }

        return summaries;
    }

    private async writeReports(
        transactions: Transaction[],
        annualSummary: AnnualSummary[]
    ): Promise<void> {
        await this.csvWriter.writeRecords(transactions);
        await this.summaryWriter.writeRecords(annualSummary);
    }
}