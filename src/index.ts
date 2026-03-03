import { processAllPdfs } from './services/pdf-extractor';
import { TransactionService } from './services/transaction-service';

export async function main() {
    try {
        console.log('Starting Block Stock ACB Calculator...');
        await processAllPdfs();
        const transactionService = new TransactionService(false);
        await transactionService.processTransactions();
        console.log('Processing complete. Check acb_transactions.csv and annual_summary.csv for results.');
    } catch (error) {
        console.error('Error occurred:', error);
        throw error;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}