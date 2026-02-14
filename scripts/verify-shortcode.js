const http = require('http');

const shortCode = 'Q0J42X3d'; // ID from previous step
const url = `http://localhost:3000/p/${shortCode}`;

console.log(`Testing URL: ${url}`);

http.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log('Redirect Location:', res.headers.location);
        if (res.headers.location && res.headers.location.includes('checkout.stripe.com')) {
            console.log('SUCCESS: Redirects to Stripe');
        } else {
            console.log('WARNING: Redirects but not to Stripe?');
        }
    } else if (res.statusCode === 404) {
        console.log('FAILURE: Returned 404 Not Found');
    } else {
        console.log('FAILURE: Unexpected status code');
    }
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
