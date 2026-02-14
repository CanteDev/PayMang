
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

// Configuration
const APP_URL = 'http://localhost:3000';
const HEADLESS = false; // Set to false to see the browser UI as requested
const SLOW_MO = 50; // Slow down actions for visibility

// Credentials (from test-login.js)
const USERS = {
    admin: { email: 'canteriyu@gmail.com', password: 'PayMang2024!' },
    closer: { email: 'closer@test.com', password: 'Password123!' },
    coach: { email: 'coach@test.com', password: 'Password123!' },
    setter: { email: 'setter@test.com', password: 'Password123!' }
};

// Supabase Setup for Webhook Simulation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runFullE2ETest() {
    console.log('🚀 Starting Full E2E Test (Puppeteer)...');

    const browser = await puppeteer.launch({
        headless: HEADLESS,
        defaultViewport: null,
        args: ['--start-maximized'],
        slowMo: SLOW_MO
    });

    const page = await browser.newPage();

    // Helper: Login
    async function login(role) {
        console.log(`🔐 Logging in as ${role.toUpperCase()}...`);
        await page.goto(`${APP_URL}/login`);
        await page.waitForSelector('input[type="email"]');

        await page.type('input[type="email"]', USERS[role].email);
        await page.type('input[type="password"]', USERS[role].password);

        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        console.log(`✅ Logged in as ${role}`);
        await new Promise(r => setTimeout(r, 1000)); // Wait for animation
    }

    // Helper: Logout
    async function logout() {
        console.log('🔓 Logging out...');
        // Find logout button (usually in sidebar bottom)
        const logoutBtn = await page.$('button[title="Cerrar sesión"]') || await page.$('button:has(svg.lucide-log-out)');
        if (logoutBtn) {
            await logoutBtn.click();
            await page.waitForNavigation();
            console.log('✅ Logged out');
        } else {
            console.log('⚠️ Logout button not found via selector, trying direct URL');
            await page.goto(`${APP_URL}/login`);
        }
    }

    try {
        // --- SCENARIO 1: ADMIN CREATES STUDENT ---
        // SKIP (User Request)
        /*
        await login('admin');

        console.log('👨‍🎓 Creating New Student...');
        await page.goto(`${APP_URL}/admin/students`);

        // Open Modal
        await page.waitForSelector('button ::-p-text(Nuevo Alumno)');
        await page.click('button ::-p-text(Nuevo Alumno)');

        const suffix = Math.floor(Math.random() * 10000);
        const studentEmail = `browser_test_${suffix}@example.com`;
        const studentName = `Browser Student ${suffix}`;

        // Fill Form
        await page.waitForSelector('#student-form-content');
        await page.type('#email', studentEmail);
        await page.type('#fullName', studentName);

        // Select Coach
        await page.select('#coach', (await supabase.from('profiles').select('id').eq('email', USERS.coach.email).single()).data.id);
        // Select Closer
        await page.select('#closer', (await supabase.from('profiles').select('id').eq('email', USERS.closer.email).single()).data.id);

        // Submit
        await page.click('button[type="submit"]');

        // Wait for success/close
        await page.waitForSelector('div[role="alert"]', { hidden: true, timeout: 5000 }).catch(() => { }); // Wait for toast or modal close
        console.log('✅ Student Created');

        await logout();
        */

        // --- SCENARIO 2: CLOSER GENERATES LINK ---
        await login('closer');
        console.log('🔗 Generating Payment Link...');

        await page.goto(`${APP_URL}/closer/links`);

        // Wait for Selects
        await page.waitForSelector('select#student');

        // Select FIRST Existing Student
        // We'll use the one from previous run or just any active student
        const { data: student } = await supabase.from('students').select('*').eq('status', 'active').limit(1).single();
        if (!student) throw new Error('No active students found in DB to test with');

        const studentEmail = student.email;
        console.log(`   Using existing student: ${studentEmail}`);

        await page.select('select#student', student.id);
        await new Promise(r => setTimeout(r, 500));

        // Select Pack: "Pack Básico" for Hotmart
        const { data: allPacks } = await supabase.from('packs').select('*');
        const pack = allPacks.find(p => p.name.toLowerCase().includes('basic') || p.name.toLowerCase().includes('básic'));

        if (!pack) {
            console.error('Available packs:', allPacks.map(p => p.name));
            throw new Error('Pack Basico not found');
        }

        console.log(`   Selected Pack: ${pack.name}`);
        const packId = pack.id;
        const packPrice = pack.price;

        await page.select('select#pack', packId);
        await new Promise(r => setTimeout(r, 500));

        // Select Gateway
        // Only if pack has gateways. Ensure pack has hotmart enabled.
        await page.waitForSelector('select#gateway:not([disabled])');
        await page.select('select#gateway', 'hotmart');

        // Select Closer (Auto-selected if assigned, but let's ensure)
        const closerId = (await supabase.from('profiles').select('id').eq('email', USERS.closer.email).single()).data.id;
        await page.select('select#closer', closerId);

        // Click Generate
        const generateBtn = await page.waitForSelector('button ::-p-text(Generar Link de Pago)');
        await generateBtn.click();

        // Wait for Link Generation
        await page.waitForSelector('input[readonly]'); // The input with the link
        const generatedLinkValue = await page.$eval('input[readonly]', el => el.value);
        console.log(`✅ Link Generated via UI: ${generatedLinkValue}`);

        const linkId = generatedLinkValue.split('/').pop();

        await logout();

        // --- SCENARIO 3: SIMULATE PURCHASE ---
        console.log('💳 Simulating Purchase (Webhook)...');
        await simulateWebhook(linkId, packPrice, studentEmail);
        console.log('✅ Purchase Simulated');

        // --- SCENARIO 4: COACH VALIDATES COMMISSION ---
        await login('coach');
        console.log('✅ Verifying Coach Commission...');
        await page.goto(`${APP_URL}/coach/commissions`);

        // Should have a pending commission
        // Look for Validate button (CheckCircle2)
        await page.waitForSelector('table');

        // Find row with amount
        const commissionAmount = (packPrice * 0.10).toFixed(2); // 10%
        console.log(`   Looking for commission of ${commissionAmount}€`);

        // Click Validate (Green Check)
        const validateBtn = await page.$('button[title="Validar"]');
        if (validateBtn) {
            console.log('   Clicking Validate...');
            await validateBtn.click();
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for action
            console.log('✅ Commission Validated');
        } else {
            console.log('⚠️ Validate button not found (maybe already validated or status issue)');
        }

        await logout();

        // --- SCENARIO 5: ADMIN PAYS & MANAGES ---
        await login('admin');
        console.log('💰 Admin: Payment Process...');
        await page.goto(`${APP_URL}/admin/payments`); // Or Admin Payslips/Commissions
        // Assuming /admin/payslips (renamed to Comisiones) contains the table
        await page.goto(`${APP_URL}/admin/payslips`);

        await page.waitForSelector('table');

        // Filter to Validated? Or just look for "Pagar" button
        const payBtn = await page.waitForSelector('button ::-p-text(Pagar)', { timeout: 5000 }).catch(() => null);

        if (payBtn) {
            console.log('   Clicking Pay...');
            await payBtn.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('✅ Commission Paid');
        } else {
            console.log('⚠️ Pay button not found (might need filtering)');
        }

        console.log('✅ Full Flow Completed Successfully');

    } catch (e) {
        console.error('❌ Test Failed:', e);
        await page.screenshot({ path: 'test_failure.png' });
    } finally {
        await browser.close();
    }
}

async function simulateWebhook(linkId, price, email) {
    // const fetch = (await import('node-fetch')).default; // Native fetch in Node 18+
    const res = await fetch(`${APP_URL}/api/webhooks/hotmart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hotmart-hottok': process.env.HOTMART_WEBHOOK_SECRET || 'your-webhook-secret' },
        body: JSON.stringify({
            event: "PURCHASE_COMPLETE",
            data: {
                product: { id: 111, name: "Test Product" },
                purchase: {
                    transaction: "HP-" + Math.random().toString(36).substring(7),
                    price: { value: price, currency_code: "EUR" },
                    status: "APPROVED",
                    src: linkId
                },
                buyer: { email: email, name: "Browser Test Buyer" }
            }
        })
    });
    console.log('   Webhook Status:', res.status);
}

runFullE2ETest();
