import 'dotenv/config';
import { processHotmartSync } from '../app/actions/sync';

async function main() {
    console.log('Testing Hotmart Sync Execution...');
    try {
        const result = await processHotmartSync();
        console.log('Sync Result:', JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main();
