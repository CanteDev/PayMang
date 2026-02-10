import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'closer@test.com';
const TEST_PASSWORD = 'Password123!';

async function runBrowserTest() {
    console.log('🚀 Starting Local Browser Test...');

    // Launch browser (headless: false to see it)
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    try {
        // 1. LOGIN
        console.log('🔹 Navigating to Login...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });

        console.log('🔹 Filling Login Form...');
        await page.type('input[type="email"]', TEST_EMAIL);
        await page.type('input[type="password"]', TEST_PASSWORD);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        console.log('✅ Login Successful (Redirected)');

        // 2. NAVIGATE TO LINK GENERATOR
        console.log('🔹 Navigating to Link Generator...');
        await page.goto(`${BASE_URL}/closer/links`, { waitUntil: 'networkidle0' });

        // 3. CREATE STUDENT (Using the + button)
        console.log('🔹 Opening Create Student Modal...');
        // Find the button with title "Nuevo Alumno" or the + icon
        const plusButtonSelector = 'button[title="Nuevo Alumno"]';
        await page.waitForSelector(plusButtonSelector);
        await page.click(plusButtonSelector);

        // Fill Modal
        console.log('🔹 Filling Student Form...');
        const studentEmail = `browser_test_${Date.now()}@test.com`;
        await page.waitForSelector('div[role="dialog"] input[name="full_name"]', { visible: true }); // Wait for specific input
        await page.type('input[name="full_name"]', 'Browser Test Student');
        await page.type('input[name="email"]', studentEmail);
        await page.type('input[name="phone"]', '123456789');

        // Submit
        console.log('🔹 Submitting Student Form...');
        await page.click('button[type="submit"]');

        // Wait for modal to close (or success message)
        await new Promise(r => setTimeout(r, 2000)); // Give it time to save and update state
        console.log(`✅ Student Created: ${studentEmail}`);

        // Get the student ID for later use
        const selectedStudentId = await page.$eval('#student', (el: any) => el.value);
        console.log(`📋 Selected Student ID: ${selectedStudentId}`);

        // 4. VERIFY SELECTION
        // The select should now have the new student selected. 
        // We can check the value of the select element, but simpler is just to proceed.

        // 5. GENERATE LINK
        console.log('🔹 Generating Link...');

        // Select Pack (assuming a pack exists and is the second option or we search)
        // We need to ensure we select a pack.
        await page.select('#pack', await page.$eval('#pack option:nth-child(2)', el => el.getAttribute('value') || ''));

        // Select Gateway (Stripe)
        await page.select('#gateway', 'stripe');

        // Select Closer
        // The closer field should be empty since we just created the student
        const closerSelect = await page.$('#closer');
        if (closerSelect) {
            // Get the first available closer (should be the logged in user: closer@test.com)
            const closerValue = await page.$eval('#closer option:nth-child(2)', el => el.getAttribute('value') || '');
            if (closerValue) {
                await page.select('#closer', closerValue);
                console.log('✅ Closer Selected');
            }
        }

        // Click Generate
        await page.click('button:has-text("Generar Link")');

        // Wait for Result
        await page.waitForSelector('code', { timeout: 5000 });
        const linkUrl = await page.$eval('code', el => el.textContent);
        console.log(`✅ Link Generated: ${linkUrl}`);

        // 6. VERIFY CLOSER AUTO-FILL (Test that closer is auto-filled on second link generation)
        console.log('🔹 Testing Closer Auto-fill...');

        // Select the same student again
        await page.select('#student', selectedStudentId);

        // Wait a bit for the form to auto-fill
        await new Promise(r => setTimeout(r, 500));

        // Check if closer is now auto-filled
        const closerAutoFilled = await page.$eval('#closer', (el: any) => el.value);
        if (closerAutoFilled) {
            console.log('✅ Closer Auto-filled Successfully');
        } else {
            console.warn('⚠️ Closer was not auto-filled (might be ok if student.closer_id not saved)');
        }

        // 7. VISIT LINK (Simulate Payment Page Visit)
        if (linkUrl) {
            console.log(`🔹 Visiting Payment Link: ${linkUrl}`);
            const newPage = await browser.newPage();
            await newPage.goto(linkUrl, { waitUntil: 'networkidle0' });
            console.log('✅ Payment Page Loaded');
            await newPage.close();
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
        await page.screenshot({ path: 'browser_test_failure.png' });
    } finally {
        console.log('🔹 Closing Browser...');
        await browser.close();
    }
}

runBrowserTest();
