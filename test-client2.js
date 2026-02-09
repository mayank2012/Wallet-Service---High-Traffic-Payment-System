const http = require('http');

const req = http.get('http://127.0.0.1:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Success!');
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Error:', err.message);
  console.error('Code:', err.code);
  process.exit(1);
});

req.setTimeout(3000, () => {
  console.error('Timeout');
  process.exit(1);
});
