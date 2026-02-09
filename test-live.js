// Quick test of the wallet API
const http = require('http');

const endpoints = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/wallets/1' },
  { method: 'GET', path: '/api/wallets/1/GOLD' },
];

async function testEndpoint(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            success: true,
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            success: true,
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing Wallet Service API...\n');

  for (const endpoint of endpoints) {
    try {
      const result = await testEndpoint(endpoint.method, endpoint.path);
      console.log(`✓ ${endpoint.method} ${endpoint.path}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Response:`, JSON.stringify(result.data, null, 2).substring(0, 200));
      console.log();
    } catch (error) {
      console.log(`✗ ${endpoint.method} ${endpoint.path}`);
      console.log(`  Error: ${error.message}`);
      console.log();
    }
  }
}

// Test topup transaction
async function testTransaction() {
  console.log('Testing Transaction Endpoint...\n');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/transactions/topup',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      userId: 1,
      assetCode: 'GOLD',
      amount: 1000,
      orderId: 'order-test-001',
      idempotencyKey: 'test-idem-' + Date.now()
    });

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          console.log(`✓ POST /api/transactions/topup`);
          console.log(`  Status: ${res.statusCode}`);
          console.log(`  Response:`, JSON.stringify(result, null, 2));
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Run all tests
(async () => {
  await runTests();
  try {
    await testTransaction();
  } catch (error) {
    console.error('Transaction test failed:', error.message);
  }
})();
