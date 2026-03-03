export interface MonetaryValue {
    value: number;
    toString(): string;
}

export interface Transaction {
    Date: string;
    Transaction_Type: 'VEST' | 'SELL';
    Shares: number;
    Price_Per_Share: MonetaryValue;
    Price_Per_Share_CAD: MonetaryValue;
    Exchange_Rate: number;
    Total_Value: MonetaryValue;
    Total_Value_CAD: MonetaryValue;
    Running_Share_Balance: number;
    Running_ACB: MonetaryValue;
    Running_ACB_CAD: MonetaryValue;
    ACB_Per_Share: MonetaryValue;
    ACB_Per_Share_CAD: MonetaryValue;
    Capital_Gain_Loss?: MonetaryValue;
    Capital_Gain_Loss_CAD?: MonetaryValue;
    Superficial_Loss_Shares?: number;
    Year: number;
    Potential_Sell_To_Cover?: boolean;
    Is_ESPP: boolean;
}

export interface RawTransaction {
    Date: string;
    Transaction_Type: 'VEST' | 'SELL';
    Shares: number;
    Price_Per_Share: number;
    Total_Value: number;
    Year: number;
    Is_ESPP: boolean;
}

export interface SuperficialLossResult {
    superficialLossShares: number;
    deniedLoss: number;
}

export interface SellRecord {
    'Record Type': string;
    'Date Sold': string;
    'Qty.': number;
    'Proceeds Per Share': number;
    'Total Proceeds': number;
}

export interface AnnualSummary {
    Year: string | number;
    Total_Vested: number;
    Total_Sold: number;
    Total_Proceeds: MonetaryValue;         // USD
    Total_Proceeds_CAD: MonetaryValue;     // CAD
    Total_Cost_Base: MonetaryValue;        // USD
    Total_Cost_Base_CAD: MonetaryValue;    // CAD
    Net_Capital_Gain_Loss: MonetaryValue;  // USD (should equal Total_Proceeds - Total_Cost_Base)
    Net_Capital_Gain_Loss_CAD: MonetaryValue; // CAD (should equal Total_Proceeds_CAD - Total_Cost_Base_CAD)
    Period_End_Shares: number;
    Period_End_ACB: MonetaryValue;
    Period_End_ACB_CAD: MonetaryValue;
    Period_End_ACB_Per_Share: MonetaryValue;
    Period_End_ACB_Per_Share_CAD: MonetaryValue;
}

export interface ExchangeRateResponse {
    observations: Array<{
        d: string;
        FXUSDCAD: {
            v: string;
        };
    }>;
}