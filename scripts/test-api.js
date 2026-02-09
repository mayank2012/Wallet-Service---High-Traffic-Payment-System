#!/usr/bin/env node

/**
 * API Testing Script
 * Run test scenarios against the Wallet Service
 * 
 * Usage: node scripts/test-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Test scenarios
const tests = [
  {
    name: 'Health Check',
    run: async () => {
      return makeRequest('GET', '/health');
    }
  },
  {
    name: 'Get Alice Wallets',
    run: async () => {
      return makeRequest('GET', '/api/wallets/1');
    }
  },
  {
    name: 'Get Alice Gold Balance',
    run: async () => {
      return makeRequest('GET', '/api/wallets/1/GOLD');
    }
  },
  {
    name: 'Top-Up Alice 1000 Gold',
    run: async () => {
      return makeRequest('POST', '/api/transactions/topup', {
        userId: 1,
        assetCode: 'GOLD',
        amount: 1000,
        orderId: 'order-test-001',
        idempotencyKey: 'test-topup-001'
      });
    }
  },
  {
    name: 'Issue Bonus to Alice (should detect duplicate)',
    run: async () => {
      const key = 'test-bonus-001';
      // First request
      const first = await makeRequest('POST', '/api/transactions/bonus', {
        userId: 1,
        assetCode: 'LOYALTY_POINTS',
        amount: 100,
        reason: 'Test bonus',
        idempotencyKey: key
      });

      // Wait a moment
      await new Promise(r => setTimeout(r, 500));

      // Retry with same key (should be duplicate)
      const second = await makeRequest('POST', '/api/transactions/bonus', {
        userId: 1,
        assetCode: 'LOYALTY_POINTS',
        amount: 100,
        reason: 'Test bonus',
        idempotencyKey: key
      });

      return {
        status: second.status,
        data: {
          firstRequest: first.data,
          secondRequest: second.data,
          isDuplicate: second.data.isDuplicate
        }
      };
    }
  },
  {
    name: 'Spend 500 Gold',
    run: async () => {
      return makeRequest('POST', '/api/transactions/spend', {
        userId: 1,
        assetCode: 'GOLD',
        amount: 500,
        itemName: 'Legendary Sword',
        idempotencyKey: 'test-spend-001'
      });
    }
  },
  {
    name: 'Try to Spend More Than Balance (should fail)',
    run: async () => {
      return makeRequest('POST', '/api/transactions/spend', {
        userId: 1,
        assetCode: 'GOLD',
        amount: 999999,
        itemName: 'Impossible Purchase',
        idempotencyKey: 'test-fail-001'
      });
    }
  },
  {
    name: 'Get Updated Balance',
    run: async () => {
      return makeRequest('GET', '/api/wallets/1/GOLD');
    }
  },
  {
    name: 'Get Transaction History',
    run: async () => {
      return makeRequest('GET', '/api/transactions/history/1/GOLD?limit=10');
    }
  },
  {
    name: 'Validate Wallet State',
    run: async () => {
      return makeRequest('GET', '/api/audit/validate/1');
    }
  }
];

// Run tests
async function runTests() {
  console.log('\n========================================');
  console.log('   Wallet Service API Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n[${tests.indexOf(test) + 1}/${tests.length}] ${test.name}...`);
      const result = await test.run();
      
      console.log(`     Status: ${result.status}`);
      console.log(`     Response:`);
      
      if (typeof result.data === 'string') {
        console.log(`     ${result.data.substring(0, 100)}`);
      } else {
        console.log(`     ${JSON.stringify(result.data, null, 2).split('\n').slice(0, 5).join('\n     ')}`);
      }
      
      if (result.status >= 200 && result.status < 400) {
        console.log('     ✓ PASSED');
        passed++;
      } else {
        console.log('     ✗ FAILED');
        failed++;
      }
    } catch (error) {
      console.log(`     ✗ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
console.log('Checking if Wallet Service is running...');
makeRequest('GET', '/health')
  .then(() => {
    console.log('✓ Service is running!\n');
    runTests();
  })
  .catch(() => {
    console.error('✗ Cannot connect to Wallet Service at ' + BASE_URL);
    console.error('Make sure the service is running: npm start');
    process.exit(1);
  });
