const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5173,
    path: '/',
    method: 'GET'
};

const checkPort = () => {
    const req = http.request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 304) {
             console.log('Port 5173 is open!');
             process.exit(0);
        } else {
             setTimeout(checkPort, 1000);
        }
    });

    req.on('error', (e) => {
        setTimeout(checkPort, 1000);
    });

    req.end();
};

checkPort();
