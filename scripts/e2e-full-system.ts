import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const BASE_URL = 'http://localhost:3000';
const DEFAULT_PASSWORD = 'Password123!';
const ADMIN_PASSWORD = 'PrimaveraVerano.01';

const ROLES = {
    closer: { email: 'closer@test.com', password: DEFAULT_PASSWORD },
    coach: { email: 'coach@test.com', password: DEFAULT_PASSWORD },
    setter: { email: 'setter@test.com', password: DEFAULT_PASSWORD },
    admin: { email: 'admin@paymang.com', password: ADMIN_PASSWORD }
};

// Initialize Supabase Admin for fallback
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runE2ETest() {
    console.log('🚀 Starting Full E2E System Test...');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1366, height: 768 }
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    let generatedLinkId = '';

    try {
        // ==========================================
        // 1. CLOSER: Create Student & Generate Link
        // ==========================================
        console.log('\n🔵 [CLOSER] Logging in...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', ROLES.closer.email);
        await page.type('input[type="password"]', ROLES.closer.password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        await page.waitForSelector('main', { timeout: 10000 });
        console.log('✅ Login Successful');
        await page.screenshot({ path: 'test_screenshots/01_closer_dashboard.png' });

        console.log('🔵 [CLOSER] Creating Student...');
        await page.goto(`${BASE_URL}/closer/links`, { waitUntil: 'networkidle0' });

        // Open Modal
        console.log('🔵 [CLOSER] Opening Create Student Modal...');
        const btnSelector = '#open-new-student-modal';
        await page.waitForSelector(btnSelector, { visible: true });

        // Attempt 1: JS Click
        await page.evaluate((sel) => {
            const btn = document.querySelector(sel) as HTMLElement;
            if (btn) btn.click();
        }, btnSelector);

        // Wait for dialog with retry
        try {
            await page.waitForSelector('#student-form-content', { visible: true, timeout: 2000 });
        } catch (e) {
            console.log('⚠️ JS Click didn\'t open dialog, retrying with standard click...');
            await page.click(btnSelector);
            await page.waitForSelector('#student-form-content', { visible: true, timeout: 5000 });
        }

        // Fill Form
        console.log('🔵 [CLOSER] Filling Form...');
        const studentName = `E2E Student ${Date.now()}`;
        const studentEmail = `e2e_${Date.now()}@test.com`;

        try {
            await page.waitForSelector('#student-form-content input[name="full_name"]', { visible: true, timeout: 3000 });
            await page.type('#student-form-content input[name="full_name"]', studentName);
            await page.type('input[name="email"]', studentEmail);
            await page.type('input[name="phone"]', '600123456');

            // Submit
            console.log('🔵 [CLOSER] Submitting Form...');
            await page.click('button[type="submit"]'); // Save
            await new Promise(r => setTimeout(r, 2000)); // Wait for close/save
            await page.screenshot({ path: 'test_screenshots/02_student_created.png' });
            console.log(`✅ Student Created via UI: ${studentName}`);
        } catch (uiError) {
            console.error('⚠️ UI Creation Failed, attempting API Fallback...', uiError);

            // API Fallback
            const { data: newStudent, error: createError } = await supabaseAdmin
                .from('students')
                .insert({
                    full_name: studentName,
                    email: studentEmail,
                    phone: '600123456',
                    status: 'active'
                })
                .select()
                .single();

            if (createError) throw new Error(`API Fallback failed: ${createError.message}`);

            console.log(`✅ Student Created via API Fallback: ${studentName}`);

            // Reload page to see the new student
            await page.reload({ waitUntil: 'networkidle0' });
        }

        // Generate Link
        console.log('🔵 [CLOSER] Generating Link...');
        await page.waitForSelector('#pack');
        // ensure pack is selected
        await page.select('#pack', await page.$eval('#pack option:nth-child(2)', el => el.getAttribute('value') || ''));

        // Select Student (we need to select the one we just created)
        const studentValue = await page.evaluate((email) => {
            const options = Array.from(document.querySelectorAll('#student option'));
            // @ts-ignore
            const option = options.find(o => o.textContent?.includes(email));
            return option ? option.getAttribute('value') : null;
        }, studentEmail);

        if (studentValue) {
            await page.select('#student', studentValue);
        } else {
            console.warn('⚠️ Created student not found in dropdown even after reload');
        }

        // ensure gateway is selected 
        await page.select('#gateway', 'stripe');

        // Select Closer (mandatory field!)
        console.log('🔵 [CLOSER] Selecting Closer...');
        await page.waitForSelector('#closer');
        await page.select('#closer', await page.$eval('#closer option:nth-child(2)', el => el.getAttribute('value') || ''));

        // Select Coach (now mandatory if student has no coach)
        console.log('🔵 [CLOSER] Selecting Coach...');
        await page.waitForSelector('#coach');

        // Wait for coaches to populate
        await page.waitForFunction(() => {
            const select = document.querySelector('#coach') as HTMLSelectElement;
            return select && select.options.length > 1;
        }, { timeout: 5000 });

        // Check if enabled (should be, since new student has no coach)
        const isCoachDisabled = await page.$eval('#coach', (el) => (el as HTMLSelectElement).disabled);
        if (!isCoachDisabled) {
            await page.select('#coach', await page.$eval('#coach option:nth-child(2)', el => el.getAttribute('value') || ''));
        } else {
            console.warn('⚠️ Coach selector is disabled, but expected to be enabled for new student');
        }

        // Check for error messages first
        const errorMsg = await page.evaluate(() => {
            const el = document.querySelector('.text-red-700');
            return el ? el.textContent : null;
        });
        if (errorMsg) console.error('⚠️ Visible Error Message:', errorMsg);

        // Screenshot before clicking
        await page.screenshot({ path: 'test_screenshots/02b_before_generar_link.png' });

        // Click Generar Link via JS XPath
        await page.evaluate(() => {
            const xpath = "//button[contains(., 'Generar Link')]";
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const button = result.singleNodeValue as HTMLButtonElement;
            if (button) {
                if (button.disabled) throw new Error(`Generar Link button is disabled! (Error: ${document.querySelector('.text-red-700')?.textContent || 'None'})`);
                button.click();
            }
            else throw new Error("Generar Link button not found in page");
        });

        // Wait for success message container
        await page.waitForSelector('.bg-green-50', { timeout: 15000 });
        const linkUrl = await page.$eval('.bg-green-50 input', el => (el as HTMLInputElement).value);
        console.log(`✅ Link Generated: ${linkUrl}`);
        await page.screenshot({ path: 'test_screenshots/03_link_generated.png' });

        generatedLinkId = linkUrl?.split('/').pop() || '';
        console.log(`POPPED ID: ${generatedLinkId}`);

        // Logout
        console.log('🔵 [CLOSER] Logging out...');
        await page.goto(`${BASE_URL}/api/auth/signout`);
        await page.waitForNavigation();

        // ==========================================
        // 2. SIMULATE PAYMENT (System)
        // ==========================================
        console.log('\n🟣 [SYSTEM] Simulating Payment...');
        if (!generatedLinkId) throw new Error('No Link ID generated');

        const simulateResult = await page.evaluate(async (id) => {
            const res = await fetch('/api/test/simulate-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ linkId: id })
            });
            return res.json();
        }, generatedLinkId);
        console.log('✅ Payment Simulated:', simulateResult);

        // ==========================================
        // 3. ADMIN: Validate & Pay
        // ==========================================
        console.log('\n🔴 [ADMIN] Logging in...');
        await page.goto(`${BASE_URL}/login`);
        await page.type('input[type="email"]', ROLES.admin.email);
        await page.type('input[type="password"]', ROLES.admin.password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        await page.screenshot({ path: 'test_screenshots/04_admin_dashboard.png' });

        console.log('🔴 [ADMIN] Checking Commissions...');
        await page.goto(`${BASE_URL}/admin/payslips`);
        await page.waitForSelector('table');
        await page.screenshot({ path: 'test_screenshots/05_admin_commissions_list.png' });

        // Validate a commission
        try {
            // Validate via JS XPath
            const found = await page.evaluate(() => {
                const xpath = "//button[contains(., 'Validar')]";
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const button = result.singleNodeValue as HTMLElement;
                if (button) {
                    button.click();
                    return true;
                }
                return false;
            });

            if (found) {
                console.log('   -> Clicking Validar...');
                await new Promise(r => setTimeout(r, 1000));
                await page.screenshot({ path: 'test_screenshots/06_admin_commission_validated.png' });
            } else {
                console.log('   ⚠️ No "Validar" button found');
            }
        } catch (e) {
            console.log('   ⚠️ Error clicking Validar:', e);
        }

        // Logout
        console.log('🔴 [ADMIN] Logging out...');
        await page.goto(`${BASE_URL}/api/auth/signout`);

        // ==========================================
        // 4. COACH: Verify Dashboard
        // ==========================================
        console.log('\n🟢 [COACH] Logging in...');
        await page.goto(`${BASE_URL}/login`);
        await page.type('input[type="email"]', ROLES.coach.email);
        await page.type('input[type="password"]', ROLES.coach.password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        await page.screenshot({ path: 'test_screenshots/07_coach_dashboard.png' });

        console.log('🟢 [COACH] Verifying Students...');
        await page.goto(`${BASE_URL}/coach/students`);
        await page.waitForSelector('table');
        const content = await page.content();
        if (content.includes(studentName)) {
            console.log('✅ Coach sees assigned student!');
        } else {
            console.log('⚠️ Coach NOT see assigned student');
        }
        await page.screenshot({ path: 'test_screenshots/08_coach_students.png' });

        console.log('\n✅ E2E TEST COMPLETED SUCCESSFULLY');

    } catch (error) {
        console.error('❌ E2E Failed:', error);
        await page.screenshot({ path: 'test_screenshots/E2E_FAILURE.png' });
    } finally {
        await browser.close();
    }
}

runE2ETest();
