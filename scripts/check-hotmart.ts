import { hotmart } from '../lib/hotmart';

async function run() {
    try {
        const response: any = await hotmart.request('https://developers.hotmart.com/products/api/v1/products', {
            method: 'GET'
        });
        const items = response?.items || response?.data || [];
        const activeItems = items.filter((prod: any) => prod.status === 'ACTIVE');
        console.log('Active Products:', activeItems.map((a: any) => a.name));
    } catch (e) {
        console.error(e);
    }
}
run();
