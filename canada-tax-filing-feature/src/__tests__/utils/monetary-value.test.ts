import { createMonetaryValue } from '../../utils';

describe('createMonetaryValue', () => {
    it('demonstrates number vs string formatting', () => {
        const value = createMonetaryValue(2959.60);
        
        // The numeric value drops trailing zeros
        expect(value.value).toBe(2959.6);
        
        // But toString() always formats with 2 decimal places
        expect(value.toString()).toBe('2959.60');
        
        // More examples
        const examples = [
            1000.00,    // Whole number
            1000.10,    // One decimal
            1000.56789, // Many decimals
            0.50,       // Less than 1
        ];
        
        examples.forEach(num => {
            const monetary = createMonetaryValue(num);
            console.log({
                input: num,
                value: monetary.value,
                toString: monetary.toString()
            });
            // Verify toString always has 2 decimal places
            expect(monetary.toString()).toMatch(/^\d+\.\d{2}$/);
        });
    });
});