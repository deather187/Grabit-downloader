const http = require('http');
const fs = require('fs');
const path = require('path');

const data = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    formatId: 'best',
    removeWatermark: false
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/download',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    console.log(`headers:`, res.headers);

    if (res.statusCode === 200) {
        const file = fs.createWriteStream(path.join(__dirname, 'test_download.mp4'));
        res.pipe(file);
        file.on('finish', () => {
            console.log('Download saved to test_download.mp4');
        });
    } else {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => console.error('Error body:', body));
    }
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
