# Block Stock ACB Calculator

## ⚠️ Disclaimer
This tool is provided for informational purposes only and should not be considered as professional tax advice. The calculations should be verified by a qualified tax professional. The author(s) are not responsible for any errors or actions taken based on the information provided.

## Important Notes
- Processes: RSU vests, ESPP purchases, sell-to-cover, and manual sells
- Does NOT include: Manual purchases
- Uses average cost basis method (Canadian ACB), NOT the FIFO method shown in E*TRADE

## Introduction
Calculate Adjusted Cost Base (ACB) and capital gains/losses for Block stocks (RSU vests, ESPP purchases, and sells) for Canadian tax filing.

## Setup
1. Clone and install dependencies:
```bash
git clone org-49461806@github.com:squareup/canada-tax-filing.git
cd canada-tax-filing
git checkout feature
npm install
mkdir sell-to-cover-pdf
```
2. Download RSU vest and ESPP purchase records:
- Go to [E*TRADE Stock Plan Confirmations](https://us.etrade.com/etx/sp/stockplan#/myAccount/stockPlanConfirmations)
- Set date range to include your earliest vest/purchase
- Click "View All"
- Right-click → Inspect → Console
- Run this code to download PDFs:
```javascript
(function() {
  // Get all rows from the table containing downloads.
  const rows = document.querySelectorAll('tbody.sp-table-body tr');

  // Create an array of download objects: { url, name }
  const downloads = [];

  rows.forEach((row, index) => {
    // Get the date from the first cell that has type="date"
    const dateCell = row.querySelector('td[type="date"]');
    let dateText = dateCell ? dateCell.textContent.trim() : "unknownDate";
    // Replace any potential slashes or spaces in the date (optional)
    dateText = dateText.replace(/\//g, "-").replace(/\s+/g, "");

    // Find the download link within the row
    const downloadAnchor = row.querySelector('a');
    if (downloadAnchor && downloadAnchor.href) {
      downloads.push({
        url: downloadAnchor.href,
        name: `${dateText}_${index}.pdf`
      });
    }
  });

  console.log(`Found ${downloads.length} download(s).`);

  // Helper function to chunk the downloads into batches of 10
  function chunkArray(arr, chunkSize) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
  }

  const batches = chunkArray(downloads, 10);

  // Function to trigger the download of a file with a custom name.
  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    // The download attribute suggests a filename (if allowed by the server)
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Trigger downloads in batches with a 3 second delay between each batch.
  async function triggerDownloads() {
    for (let i = 0; i < batches.length; i++) {
      batches[i].forEach(item => {
        triggerDownload(item.url, item.name);
      });
      console.log(`Batch ${i + 1} triggered with ${batches[i].length} downloads. Waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log("All downloads have been triggered.");
  }

  triggerDownloads();
})();

```
- (if prompt up) allow multiple downloads on Chrome
- Move all PDFs to `sell-to-cover-pdf` folder

3. Download sell records:
- Go to [E*TRADE Gains/Losses](https://us.etrade.com/etx/sp/stockplan#/myAccount/gainsLosses) (This spreadsheet only includes sell records)
- Download `G&L_Expanded.xlsx` (ensure it includes ALL Block stock sell records)
- Move to project root directory

4. Generate reports:
```bash
npm start
```

## ESPP Support
- **ESPP PDF Detection**: The tool automatically detects ESPP purchase confirmations by looking for "PlanESPP" in the PDF.
- **Fields Extracted**:
  - Purchase Date (equivalent to Release Date for RSUs)
  - Shares Purchased (equivalent to Shares Released for RSUs)
  - Purchase Value per Share (equivalent to Market Value Per Share for RSUs): This is the market value, not the discount price of ESPP benefit.
- **Sell Transactions**: ESPP shares are treated the same as other shares when sold.
- **No Sell-to-Cover**: Unlike RSUs, ESPP purchases don't have automatic sell-to-cover transactions.

## Output Files

### acb_transactions.csv
Chronological list of all transactions with detailed ACB calculations. Each row represents a single transaction with the following columns:

| Column | Description |
|--------|-------------|
| Date | Transaction date in YYYY-MM-DD format |
| Type | Transaction type: VEST (RSU vest or ESPP purchase) or SELL (stock sale) |
| Shares | Number of shares (positive for vests, negative for sells) |
| Price/Share (USD) | Share price in USD |
| Exchange Rate | Bank of Canada exchange rate for the transaction date* |
| Price/Share (CAD) | Share price in CAD (Price/Share USD × Exchange Rate) |
| Total Value (USD) | Total transaction value in USD (Shares × Price/Share USD) |
| Total Value (CAD) | Total transaction value in CAD (Total Value USD × Exchange Rate) |
| Share Balance | Running total of shares held after the transaction |
| Running ACB (USD) | Total adjusted cost base in USD after the transaction |
| Running ACB (CAD) | Total adjusted cost base in CAD after the transaction |
| ACB/Share (USD) | Per-share ACB in USD (Running ACB USD ÷ Share Balance) |
| ACB/Share (CAD) | Per-share ACB in CAD (Running ACB CAD ÷ Share Balance) |
| Capital Gain/Loss (USD) | Capital gain/loss in USD |
| Capital Gain/Loss (CAD) | Capital gain/loss in CAD |
| Superficial Loss Shares** | Number of shares subject to superficial loss rules |
| Potential Sell-to-Cover? | Indicates if the sell might be a sell-to-cover (within 2 days of vest) |
| Is ESPP? | Indicates if the transaction is an ESPP purchase (true) or RSU vest (false) |

*For weekend/holiday transactions, this will be the last available rate from the Bank of Canada (up to 7 days prior)
**When superficial loss occurs, the denied loss is added to the ACB of the replacement shares

### annual_summary.csv
Year-by-year summary of transactions and tax implications. Each row represents a calendar year (or half-year period for 2024) with the following columns:

| Column | Description |
|--------|-------------|
| Year | Calendar year or period (e.g., '2024-H1', '2024-H2') |
| Total Shares Vested | Total number of shares vested/purchased in the period (both RSU and ESPP) |
| Total Shares Sold | Total number of shares sold in the period |
| Total Proceeds (USD) | Total value received from stock sales in USD |
| Total Proceeds (CAD) | Total value received from stock sales in CAD |
| Total Cost Base (USD) | Total cost base of shares sold in USD |
| Total Cost Base (CAD) | Total cost base of shares sold in CAD |
| Net Capital Gain/Loss (USD) | Total capital gain/loss in USD (Total Proceeds - Total Cost Base) |
| Net Capital Gain/Loss (CAD) | Total capital gain/loss in CAD (Total Proceeds - Total Cost Base) |
| Period End Shares | Number of shares held at period end |
| Period End ACB (USD) | Total adjusted cost base at period end in USD |
| Period End ACB (CAD) | Total adjusted cost base at period end in CAD |
| Period End ACB/Share (USD) | Per-share ACB at period end in USD |
| Period End ACB/Share (CAD) | Per-share ACB at period end in CAD |

#### Special 2024 Period Reporting
For the year 2024, the annual summary includes three separate reports, as the CRA requires the capital gain/loss split into 2 halves:
1. **2024-H1**: Transactions from January 1 to June 24
2. **2024-H2**: Transactions from June 25 to December 31
3. **2024 Full Year**: Complete annual summary

#### WealthSimple
Here are the steps to file the result in WealthSimple:

1. Go to the **Wealthsimple Tax** filing page.
2. Search for **"Capital Gains (or Losses)"**.
3. Create the **"Capital Gains (or Losses)"** form.
4. In the form, you will see a section labeled:
   **Period 1: January 1, 2024 – June 24, 2024**.
5. From your report:
   - Find the `Total Proceeds (CAD)` for the first half of 2024 and enter it into the **`Proceeds`** field in Wealthsimple.
   - Find the `Total Cost Base (CAD)` and enter it into the **`Cost base`** field.
6. Wealthsimple will automatically calculate the **Gain (loss)**.
7. To verify the result, compare the generated gain/loss with the `Net Capital Gain/Loss (CAD)` in your `annual_summary.csv`.
8. Repeat the same steps for **Period 2: June 25, 2024 – December 31, 2024**.


## Understanding ACB and Superficial Loss Rules

### The principle behind
The principle behind the **superficial loss rule** is to prevent investors from gaming the CRA by selling shares at a loss and immediately repurchasing them to claim a capital loss.

A superficial loss is not permanently gone; instead, the loss is added back to the **adjusted cost base (ACB)** of the repurchased shares. This effectively **defers** the capital loss until a future sale of the shares.

Over time, the **net capital gain or loss** will be similar with or without the rule, but the superficial loss rule prevents investors from receiving a **short-term tax advantage**, such as a temporary "interest-free loan" from the CRA.

### ACB Formula
The Adjusted Cost Base (ACB) is calculated differently for buy (vest) and sell transactions:

For buy/vest transactions:
```
New Total ACB = Previous Total ACB + (Share Price × Number of Shares Purchased)
```

For sell transactions:
```
New Total ACB = Previous Total ACB - (ACB per Share × Number of Shares Sold)
```

where ACB per Share is calculated as:
```
ACB per Share = Running Total ACB ÷ Running Share Balance
```

Capital gain/loss for sell transactions is calculated as:
```
Capital Gain/Loss = (Sale Price - ACB per Share) × Number of Shares Sold
```

For more details on ACB calculation, see:
[How to Calculate Adjusted Cost Base (ACB) and Capital Gains](https://www.adjustedcostbase.ca/blog/how-to-calculate-adjusted-cost-base-acb-and-capital-gains/)

### Superficial Loss Rules

The calculator first determines superficial loss shares using the formula:
```
Superficial Loss Shares = min(S, P, B)
```
where:
- S = number of shares sold
- P = total shares acquired in 61-day period (30 days before/after sale)
- B = shares remaining at end of period

Then the denied loss is calculated as:
```
Denied Loss = Total Loss × (Superficial Loss Shares/S)
```

When a superficial loss occurs:
1. The capital loss is denied
2. The denied loss is added to the ACB of the replacement shares

For more details on superficial loss rules and their application, see:
[Applying the Superficial Loss Rule for a Partial Disposition of Shares](https://www.adjustedcostbase.ca/blog/applying-the-superficial-loss-rule-for-a-partial-disposition-of-shares/)

### ⚠️ Important Notes
1. Sell-to-Cover Transactions:
   - There is ongoing debate whether sell-to-cover transactions should be exempt from superficial loss rules since they are automatically executed by the broker to cover tax obligations
   - We adopt a conservative approach and treat them as regular sales subject to superficial loss rules
   - Consult your tax professional about potentially taking a different position

2. The superficial loss calculations in this tool:
   - Are based on our interpretation of the CRA rules
   - Should be reviewed by your tax professional

Remember: Always verify these calculations with your tax professional.

## Verification
You might verify the result of this script output with:
1. https://www.adjustedcostbase.ca/
2. [RSU ACB Tracker Template for Canada](https://docs.google.com/spreadsheets/d/1TmsQ2vi1vzVkYcO4nQhg37qgXHtDs6ldddO-a7Wtdh4/edit?gid=0#gid=0)
3. accountants

For 1(without subscription) and 2, you still need to identify superficial loss by yourself.

### Comparing with RSU ACB Tracker Template
To compare our results with the RSU ACB Tracker Template:

1. Download the RSU ACB Tracker Template from the link above
2. Upload both the template Excel file and your acb_transactions.csv to ChatGPT
3. Ask ChatGPT to:
   - Fill the template using the transaction data from acb_transactions.csv
   - Mark "YES" in the Superficial Loss column where acb_transactions.csv shows Superficial Loss Shares > 0
   - Compare the calculated columns (ACB and capital gains/losses)

You might notice differences in the ACB (CAD) values between the two methods. Basically it's caused by the exchange rate conversion. Here's how they differ:

1. Our Script:
   ```
   For sell transactions:
   // Calculate everything in USD first
   gainLossUSD = shares * (sellPriceUSD - acbPerShareUSD)
   newACBUSD = previousACBUSD - (shares * acbPerShareUSD)
   if (superficialLoss) {
       newACBUSD += Math.abs(gainLossUSD)  // Add back the denied loss
   }

   // Convert final amounts to CAD
   gainLossCAD = gainLossUSD * currentExchangeRate
   newACBCAD = newACBUSD * currentExchangeRate
   ```

2. Excel Template:
   ```
   For sell transactions:
   // Convert each value to CAD using different rates
   previousACBCAD = from previous calculation (using historical exchange rate when previousACBCAD is calculated)
   sellValueCAD = shares * sellPriceUSD * currentExchangeRate
   costBaseCAD = shares * (previousACBCAD/previousShares)
   gainLossCAD = sellValueCAD - costBaseCAD

   if (superficialLoss) {
       newACBCAD = previousACBCAD - costBaseCAD + Math.abs(gainLossCAD)  // Add back the denied loss
   } else {
       newACBCAD = previousACBCAD - costBaseCAD
   }
   ```

I think our approach is more accurate because:
- All transactions happen in USD on E*TRADE
- The actual economic value of your holdings is in USD
- Converting to CAD only at tax reporting time better reflects the current value of your investment