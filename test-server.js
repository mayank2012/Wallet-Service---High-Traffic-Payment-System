const http = require('http');

console.log('Starting test server...');

const server = http.createServer((req, res) => {
  console.log('Got request:', req.method, req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ hello: 'world', time: new Date() }));
});

console.log('Attempting to listen on port 3000...');

server.listen(3000, '0.0.0.0', () => {
  console.log('✓ Test server is listening on port 3000');
});

server.on('listening', () => {
  console.log('✓ Server emitted listening event');
});

server.on('error', (err) => {
  console.error('✗ Server error:', err);
  process.exit(1);
});

// Keep process alive
setInterval(() => {
  console.log('Server still running...');
}, 5000);

