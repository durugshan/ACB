import { ExchangeRateResponse } from '../types';
import { exchangeRates } from '../data/exchange-rates';

export class ExchangeRateService {
    private static instance: ExchangeRateService;
    private rateCache: Map<string, number> = new Map();
    private useMock: boolean;
    private initialized: boolean = false;

    private constructor(useMock: boolean = false) {
        this.useMock = useMock;
        if (useMock) {
            // Load mock data
            Object.entries(exchangeRates).forEach(([date, rate]) => {
                this.rateCache.set(date, rate);
            });
            this.initialized = true;
        }
    }

    public static getInstance(useMock: boolean = false): ExchangeRateService {
        if (!ExchangeRateService.instance) {
            ExchangeRateService.instance = new ExchangeRateService(useMock);
        }
        return ExchangeRateService.instance;
    }

    // For testing purposes only
    public static resetInstance(): void {
        ExchangeRateService.instance = undefined as any;
    }

    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    public async initializeRates(transactions: Array<{ Date: string }>): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Sort and get unique dates
            const dates = [...new Set(transactions.map(t => t.Date))].sort();
            const startDate = new Date(dates[0]);
            const endDate = new Date(dates[dates.length - 1]);

            if (this.useMock) {
                this.initialized = true;
                return;
            }

            // Get exchange rates starting 7 days before the first transaction
            const fetchStartDate = this.addDays(startDate, -7);
            console.log(`Fetching exchange rates from ${this.formatDate(fetchStartDate)} to ${this.formatDate(endDate)}`);
            await this.fetchAndCacheRates(this.formatDate(fetchStartDate), this.formatDate(endDate));
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing exchange rates:', error);
            throw error;
        }
    }

    private async fetchAndCacheRates(startDate: string, endDate: string): Promise<void> {
        try {
            const url = `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${startDate}&end_date=${endDate}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
            }

            const data: ExchangeRateResponse = await response.json();
            
            if (!data.observations || data.observations.length === 0) {
                if (this.useMock) {
                    Object.entries(exchangeRates).forEach(([date, rate]) => {
                        this.rateCache.set(date, rate);
                    });
                    return;
                }
                throw new Error('No exchange rates found in response');
            }
            
            // Cache all rates
            data.observations.forEach(observation => {
                const rate = Number(observation.FXUSDCAD.v);
                this.rateCache.set(observation.d, rate);
            });
        } catch (error) {
            console.error(`Error fetching rates for ${startDate} to ${endDate}:`, error);
            throw error;
        }
    }

    private findLastAvailableRate(date: string): number | undefined {
        // Convert the target date to Date object
        const targetDate = new Date(date);
        
        // Look back up to 7 days for the last available rate
        for (let i = 0; i < 7; i++) {
            const checkDate = this.addDays(targetDate, -i);
            const formattedDate = this.formatDate(checkDate);
            const rate = this.rateCache.get(formattedDate);
            
            if (rate !== undefined) {
                if (i > 0) {
                    console.log(`Using exchange rate from ${formattedDate} for ${date} (${rate})`);
                }
                return rate;
            }
        }
        
        return undefined;
    }

    public getExchangeRate(date: string): number {
        if (!this.initialized) {
            throw new Error('Exchange rates not initialized. Call initializeRates first.');
        }

        // First try to get the exact date
        let rate = this.rateCache.get(date);
        
        // If not found, look for the last available rate
        if (rate === undefined) {
            rate = this.findLastAvailableRate(date);
        }

        if (rate === undefined) {
            console.error(`No exchange rate found for date: ${date} (including previous 7 days)`);
            throw new Error(`No exchange rate found for date: ${date}`);
        }

        return rate;
    }

    public convertToCAD(amountUSD: number, date: string): number {
        const rate = this.getExchangeRate(date);
        return Number((amountUSD * rate).toFixed(2));
    }
}