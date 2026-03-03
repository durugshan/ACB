import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { createObjectCsvWriter } from 'csv-writer';

interface ShareData {
    releaseDate: string;
    sharesReleased: string;
    marketValuePerShare: string;
    sharesSold: string;
    fileName: string;
    isESPP: boolean;
}

async function extractTextFromPdf(filePath: string): Promise<string> {
    try {
        const data = new Uint8Array(fs.readFileSync(filePath));
        const loadingTask = getDocument({
            data,
            disableFontFace: true,  // Disable font loading
            useSystemFonts: false,   // Don't use system fonts
            verbosity: 0             // Suppress warnings
        });
        const doc = await loadingTask.promise;
        const page = await doc.getPage(1);  // We only need the first page
        const content = await page.getTextContent();
        return content.items
            .filter((item): item is TextItem => 'str' in item)
            .map(item => item.str)
            .join(' ');
    } catch (error) {
        throw new Error(`Failed to read PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function extractDataFromPdf(filePath: string): Promise<ShareData> {
    const text = await extractTextFromPdf(filePath);
    const fileName = path.basename(filePath);

    // Initialize result object
    const result: ShareData = {
        releaseDate: '',
        sharesReleased: '',
        marketValuePerShare: '',
        sharesSold: '',
        fileName: fileName,
        isESPP: text.includes('ESPP')
    };

    if (result.isESPP) {
        // ESPP document extraction
        
        // Extract Purchase Date (equivalent to Release Date for RSUs)
        const purchaseDateMatch = text.match(/Purchase Date\s*(\d{2}-\d{2}-\d{4})/);
        if (purchaseDateMatch) {
            result.releaseDate = purchaseDateMatch[1].trim();
        }

        // Extract Shares Purchased (equivalent to Shares Released for RSUs)
        const sharesPurchasedMatch = text.match(/Shares Purchased\s*([\d,.]+)/);
        if (sharesPurchasedMatch) {
            result.sharesReleased = sharesPurchasedMatch[1].trim();
        }

        // Extract Purchase Value per Share (equivalent to Market Value Per Share for RSUs)
        const purchaseValueMatch = text.match(/Purchase Value per Share\s*\$?([\d,.]+)/);
        if (purchaseValueMatch) {
            result.marketValuePerShare = purchaseValueMatch[1].trim();
        }

        // ESPP doesn't have Shares Sold concept in the same way as RSUs
        result.sharesSold = '0';
    } else {
        // RSU document extraction
        
        // Extract Release Date
        const releaseDateMatch = text.match(/Release Date\s*(\d{2}-\d{2}-\d{4})/);
        if (releaseDateMatch) {
            result.releaseDate = releaseDateMatch[1].trim();
        }

        // Extract Shares Released
        const sharesReleasedMatch = text.match(/Shares Released\s*([\d,.]+)/);
        if (sharesReleasedMatch) {
            result.sharesReleased = sharesReleasedMatch[1].trim();
        }

        // Extract Market Value Per Share
        const marketValueMatch = text.match(/Market Value Per Share\s*\$?([\d,.]+)/);
        if (marketValueMatch) {
            result.marketValuePerShare = marketValueMatch[1].trim();
        }

        // Extract Shares Sold
        const sharesSoldMatch = text.match(/Shares Sold\s*\(([\d,.]+)\)/);
        if (sharesSoldMatch) {
            result.sharesSold = sharesSoldMatch[1].trim();
        }
    }

    // Validate extracted data
    if (!result.releaseDate || !result.sharesReleased || !result.marketValuePerShare) {
        throw new Error('Failed to extract required data from PDF');
    }

    return result;
}

export async function processAllPdfs() {
    const pdfDir = path.join(process.cwd(), 'sell-to-cover-pdf');
    const files = fs.readdirSync(pdfDir)
        .filter(file => file.endsWith('.pdf'))
        .sort(); // Ensure consistent sorting

    console.log(`Processing ${files.length} PDF files from ${pdfDir}`);
    const allData: ShareData[] = [];
    const failedFiles: string[] = [];

    for (const file of files) {
        const filePath = path.join(pdfDir, file);
        try {
            const data = await extractDataFromPdf(filePath);
            allData.push(data);
        } catch (error) {
            failedFiles.push(file);
            console.error(`Error processing ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (failedFiles.length > 0) {
        console.error('\nFailed to process the following files:');
        failedFiles.forEach(file => console.error(`- ${file}`));
        console.error('\nPlease check these files and ensure they are not corrupted.');
    }

    // Sort data by Release Date
    allData.sort((a, b) => {
        // Convert MM-DD-YYYY to YYYY-MM-DD for proper date sorting
        const [monthA, dayA, yearA] = a.releaseDate.split('-');
        const [monthB, dayB, yearB] = b.releaseDate.split('-');
        
        const dateA = new Date(`${yearA}-${monthA}-${dayA}`);
        const dateB = new Date(`${yearB}-${monthB}-${dayB}`);
        return dateA.getTime() - dateB.getTime();
    });

    // Create CSV writer with the new isESPP column
    const csvWriter = createObjectCsvWriter({
        path: 'share_data.csv',
        header: [
            { id: 'fileName', title: 'File Name' },
            { id: 'releaseDate', title: 'Release Date' },
            { id: 'sharesReleased', title: 'Shares Released' },
            { id: 'marketValuePerShare', title: 'Market Value Per Share' },
            { id: 'sharesSold', title: 'Shares Sold' },
            { id: 'isESPP', title: 'Is ESPP' }
        ]
    });

    // Write data to CSV
    await csvWriter.writeRecords(allData);
    
    // Count RSU and ESPP records
    const rsuCount = allData.filter(data => !data.isESPP).length;
    const esppCount = allData.filter(data => data.isESPP).length;
    const successCount = allData.length;
    const failCount = failedFiles.length;
    
    console.log(`\nProcessing complete:`);
    console.log(`- Successfully processed: ${successCount} files (${rsuCount} RSU, ${esppCount} ESPP)`);
    if (failCount > 0) {
        console.log(`- Failed to process: ${failCount} files`);
    }
}