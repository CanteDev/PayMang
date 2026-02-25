const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        console.log("Navigating to login...");
        await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle0' });

        console.log("Pressing login...");
        await page.type('input[type="email"]', 'canteriyu@gmail.com');
        await page.type('input[type="password"]', 'Primavera.99');
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        await page.goto('http://localhost:3001/admin/settings', { waitUntil: 'networkidle0' });
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
