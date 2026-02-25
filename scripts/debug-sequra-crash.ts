const { spawn } = require('child_process');
const http = require('http');

console.log('Starting dev server...');
const child = spawn('cmd', ['/c', 'npm', 'run', 'dev'], { cwd: process.cwd() });

let devLog = '';

child.stdout.on('data', (data) => {
    const text = data.toString();
    devLog += text;
    // console.log(text);
    if (text.includes('Ready in') || text.includes('ready started server')) {
        console.log('Server ready! Hitting endpoint...');
        http.get('http://localhost:3000/checkout/sequra/TzYvvIay', (res) => {
            console.log('Got response:', res.statusCode);
            setTimeout(() => {
                console.log('Logs after hitting endpoint:\n------------------------');
                const lastLines = devLog.split('\n').slice(-30).join('\n');
                console.log(lastLines);
                child.kill();
                process.exit(0);
            }, 3000);
        }).on('error', (e) => {
            console.error('Error hitting local server:', e);
            child.kill();
            process.exit(1);
        });
    }
});

child.stderr.on('data', (data) => {
    devLog += data.toString();
});

setTimeout(() => {
    console.log('Timeout. Logs so far:');
    console.log(devLog);
    child.kill();
    process.exit(1);
}, 20000);
