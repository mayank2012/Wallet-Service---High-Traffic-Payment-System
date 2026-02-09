const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        console.log(`${method} ${path}`);
        console.log(`Status: ${res.statusCode}`);
        try {
          console.log(JSON.stringify(JSON.parse(responseData), null, 2));
        } catch (e) {
          console.log(responseData);
        }
        console.log('---');
        resolve(responseData);
      });
    });

    req.on('error', (e) => {
      console.error(`Request failed: ${e.message}`);
      reject(e);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  try {
    // Test 1: Health check
    await makeRequest('GET', '/health');

    // Test 2: Get Alice's wallets (user_id = 3)
    await makeRequest('GET', '/api/wallets/3');

    // Test 3: Get Alice's GOLD wallet
    await makeRequest('GET', '/api/wallets/3/GOLD');

    // Test 4: Topup wallet
    await makeRequest('POST', '/api/transactions/topup', {
      userId: 3,
      assetCode: 'GOLD',
      amount: 1000,
      orderId: 'order-123',
      idempotencyKey: 'topup-test-' + Date.now()
    });

    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
