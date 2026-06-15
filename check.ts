import https from 'https';

https.get('https://attendance-portal-mocha.vercel.app/icon-192.png', (res) => { console.log('Status code:', res.statusCode); }).on('error', (e) => { console.error(e); });
https.get('https://attendance-portal-mocha.vercel.app/manifest.webmanifest', (res) => { res.on('data', d => process.stdout.write(d)); });
