import { MonetaryValue } from '../types';

export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseDate(dateStr: string | number): Date {
    if (typeof dateStr === 'number') {
        return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    }
    
    if (!dateStr) {
        throw new Error('Date string is undefined or empty');
    }

    if (dateStr.includes('-')) {
        const [month, day, year] = dateStr.split('-').map(Number);
        if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            return new Date(year, month - 1, day);
        }
    }
    
    if (dateStr.includes('/')) {
        const [m, d, y] = dateStr.split('/').map(Number);
        if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
            return new Date(y, m - 1, d);
        }
    }
    
    throw new Error(`Invalid date format: ${dateStr}`);
}

export function formatNumber(value: number): string {
    return value.toFixed(2);
}

export function roundForDisplay(value: number): number {
    return Number(formatNumber(value));
}

export function createMonetaryValue(value: number): MonetaryValue {
    return {
        value: roundForDisplay(value),
        toString() { return formatNumber(this.value); }
    };
}