const http = require('http');

const data = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/info',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let responseBody = '';

    res.on('data', d => {
        responseBody += d;
    });
    res.on('end', () => {
        console.log(responseBody);
    })
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
