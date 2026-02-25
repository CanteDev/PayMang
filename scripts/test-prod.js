const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

        console.log("Navigating to login...");
        await page.goto('https://pay-mang.vercel.app/login', { waitUntil: 'networkidle0' });

        console.log("Pressing login...");
        await page.type('input[type="email"]', 'canteriyu@gmail.com');
        await page.type('input[type="password"]', 'Primavera.99');
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log("Logged in. Navigating to settings...");

        await page.goto('https://pay-mang.vercel.app/admin/settings', { waitUntil: 'networkidle0' });
        console.log("On settings page. Clicking a save button...");

        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(b => b.textContent && b.textContent.includes('Guardar Información'));
            if (saveBtn) saveBtn.click();
            else console.log('Boton no encontrado');
        });

        await new Promise(r => setTimeout(r, 2000));

        await browser.close();
    } catch (e) {
        console.error("SCRIPT ERROR:", e);
    }
})();
