import { ExchangeRateService } from '../../services/exchange-rate-service';

describe('ExchangeRateService', () => {
    beforeEach(() => {
        ExchangeRateService.resetInstance();
    });

    describe('getExchangeRate', () => {
        it('should return exact rate when available', () => {
            const service = ExchangeRateService.getInstance(true);
            const rate = service.getExchangeRate('2022-11-21');
            expect(rate).toBe(1.3452);
        });

        it('should throw error when rate not found', () => {
            const service = ExchangeRateService.getInstance(true);
            expect(() => {
                service.getExchangeRate('2021-01-01');
            }).toThrow('No exchange rate found for date: 2021-01-01');
        });

        it('should use the most recent available rate for weekend/holiday dates', async () => {
            const service = ExchangeRateService.getInstance(true);
            
            // Add a rate for Friday
            (service as any).rateCache.set('2022-11-18', 1.3300);
            
            // Test for a weekend date (Sunday) - should use Friday's rate
            const rate = service.getExchangeRate('2022-11-19');
            expect(rate).toBe(1.3300);
        });

        it('should look back up to 7 days for a rate', async () => {
            const service = ExchangeRateService.getInstance(true);
            
            // Add a rate 5 days before
            const testDate = '2023-01-10';
            const fallbackDate = '2023-01-05';
            (service as any).rateCache.set(fallbackDate, 1.3700);
            
            // Should find the rate from 5 days ago
            const rate = service.getExchangeRate(testDate);
            expect(rate).toBe(1.3700);
        });

        it('should use the closest previous date when multiple rates are available', async () => {
            const service = ExchangeRateService.getInstance(true);
            
            // Add rates for multiple previous days
            (service as any).rateCache.set('2023-03-01', 1.3600);
            (service as any).rateCache.set('2023-03-02', 1.3650);
            (service as any).rateCache.set('2023-03-03', 1.3700);
            
            // Should use the most recent available rate (March 3)
            const rate = service.getExchangeRate('2023-03-05');
            expect(rate).toBe(1.3700);
        });
    });

    describe('convertToCAD', () => {
        it('should convert USD to CAD using exchange rate', () => {
            const service = ExchangeRateService.getInstance(true);
            const cadAmount = service.convertToCAD(100, '2022-11-21');
            expect(cadAmount).toBe(134.52); // 100 * 1.3452
        });

        it('should round to 2 decimal places', () => {
            const service = ExchangeRateService.getInstance(true);
            const cadAmount = service.convertToCAD(100.123, '2022-11-21');
            expect(cadAmount).toBe(134.69); // 100.123 * 1.3452 = 134.68845, rounded to 134.69
        });

        it('should throw error when rate not found', () => {
            const service = ExchangeRateService.getInstance(true);
            expect(() => {
                service.convertToCAD(100, '2021-01-01');
            }).toThrow('No exchange rate found for date: 2021-01-01');
        });

        it('should use fallback date for conversion when exact date not available', () => {
            const service = ExchangeRateService.getInstance(true);
            
            // Add a rate for a previous day
            (service as any).rateCache.set('2023-04-01', 1.3800);
            
            // Convert using a date that doesn't have a direct rate
            const cadAmount = service.convertToCAD(100, '2023-04-02');
            expect(cadAmount).toBe(138.00); // 100 * 1.3800
        });
    });

    describe('initialization', () => {
        it('should initialize with mock data', async () => {
            const service = ExchangeRateService.getInstance(true);
            await service.initializeRates([{ Date: '2022-11-21' }]);
            expect(service.getExchangeRate('2022-11-21')).toBe(1.3452);
        });

        it('should throw error if not initialized', () => {
            const service = ExchangeRateService.getInstance(false);
            expect(() => {
                service.getExchangeRate('2022-11-21');
            }).toThrow('Exchange rates not initialized');
        });
    });

    describe('findLastAvailableRate', () => {
        it('should return undefined when no rates are available within 7 days', () => {
            const service = ExchangeRateService.getInstance(true);
            
            // Clear the cache and add a rate outside the 7-day window
            (service as any).rateCache.clear();
            (service as any).rateCache.set('2023-05-01', 1.3900);
            
            // Access the private method using type casting
            const findLastAvailableRate = (service as any).findLastAvailableRate.bind(service);
            
            // Test with a date that's more than 7 days after the available rate
            const rate = findLastAvailableRate('2023-05-10');
            expect(rate).toBeUndefined();
        });

        it('should find the rate for a previous date when exact date not available', () => {
            const service = ExchangeRateService.getInstance(true);
            
            // Clear the cache and add a specific test rate
            (service as any).rateCache.clear();
            (service as any).rateCache.set('2022-11-20', 1.3385);
            
            // Access the private method using type casting
            const findLastAvailableRate = (service as any).findLastAvailableRate.bind(service);
            
            // Test with a date that should use the previous day's rate
            const rate = findLastAvailableRate('2022-11-21');
            expect(rate).toBe(1.3385);
        });
    });
});