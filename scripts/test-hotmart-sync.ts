import { processHotmartSync } from '../app/actions/sync';

async function run() {
    console.log("Starting script...");
    const res = await processHotmartSync();
    console.log("Result:", res);
}
run();
