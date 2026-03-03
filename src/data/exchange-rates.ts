// Exchange rates from Bank of Canada API
// URL: https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json
// Generated on: 2025-04-06
// Note: These are mock rates for testing purposes

export const exchangeRates: { [key: string]: number } = {
  "2022-11-20": 1.3385,  // Used for first vest
  "2022-11-21": 1.3452,  // Used for first sell
  "2023-02-20": 1.3343,  // Used for second vest
  "2023-02-21": 1.3516,  // Used for second sell
  "2024-01-15": 1.3550,  // Used for 2024 first half
  "2024-03-15": 1.3615,  // Used for 2024 first half vest
  "2024-04-15": 1.3625,  // Used for 2024 first half sell
  "2024-05-15": 1.3615,  // Used for ESPP vest
  "2024-08-20": 1.3715,  // Used for 2024 second half vest
  "2024-09-21": 1.3725   // Used for 2024 second half sell
};