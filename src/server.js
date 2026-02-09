// Express server and API routes
const express = require('express');
const walletService = require('./walletService-sqlite');
const { initializeDatabase } = require('./sqlite-init');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// BALANCE ENDPOINTS
// ============================================================================

/**
 * GET /api/wallets/:userId
 * Get all wallets for a user
 */
app.get('/api/wallets/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const wallets = await walletService.getAllWallets(parseInt(userId));

    res.json({
      success: true,
      data: wallets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/wallets/:userId/:assetCode
 * Get balance for a specific asset
 */
app.get('/api/wallets/:userId/:assetCode', async (req, res) => {
  try {
    const { userId, assetCode } = req.params;
    const wallet = await walletService.getWalletBalance(
      parseInt(userId),
      assetCode.toUpperCase()
    );

    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// TRANSACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/transactions/topup
 * Top-up wallet with credits (user purchases real money)
 * 
 * Body:
 * {
 *   "userId": 1,
 *   "assetCode": "GOLD",
 *   "amount": 1000,
 *   "orderId": "order-12345",
 *   "idempotencyKey": "uuid" (optional)
 * }
 */
app.post('/api/transactions/topup', async (req, res) => {
  try {
    const { userId, assetCode, amount, orderId, idempotencyKey } = req.body;

    // Validation
    if (!userId || !assetCode || !amount || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, assetCode, amount, orderId',
        timestamp: new Date().toISOString()
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive',
        timestamp: new Date().toISOString()
      });
    }

    const result = await walletService.topupWallet(
      parseInt(userId),
      assetCode.toUpperCase(),
      parseInt(amount),
      idempotencyKey,
      orderId
    );

    const statusCode = result.isDuplicate ? 409 : 200;

    res.status(statusCode).json({
      success: true,
      isDuplicate: result.isDuplicate,
      message: result.message || 'Wallet topped up successfully',
      data: result.transaction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/transactions/bonus
 * Issue bonus/incentive credits
 * 
 * Body:
 * {
 *   "userId": 1,
 *   "assetCode": "LOYALTY_POINTS",
 *   "amount": 100,
 *   "reason": "Referral bonus",
 *   "idempotencyKey": "uuid" (optional)
 * }
 */
app.post('/api/transactions/bonus', async (req, res) => {
  try {
    const { userId, assetCode, amount, reason, idempotencyKey } = req.body;

    // Validation
    if (!userId || !assetCode || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, assetCode, amount',
        timestamp: new Date().toISOString()
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive',
        timestamp: new Date().toISOString()
      });
    }

    const result = await walletService.issueBonus(
      parseInt(userId),
      assetCode.toUpperCase(),
      parseInt(amount),
      reason,
      idempotencyKey
    );

    const statusCode = result.isDuplicate ? 409 : 200;

    res.status(statusCode).json({
      success: true,
      isDuplicate: result.isDuplicate,
      message: result.message || 'Bonus issued successfully',
      data: result.transaction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/transactions/spend
 * Spend credits on in-app purchase
 * 
 * Body:
 * {
 *   "userId": 1,
 *   "assetCode": "GOLD",
 *   "amount": 500,
 *   "itemName": "Sword of Power",
 *   "idempotencyKey": "uuid" (optional)
 * }
 */
app.post('/api/transactions/spend', async (req, res) => {
  try {
    const { userId, assetCode, amount, itemName, idempotencyKey } = req.body;

    // Validation
    if (!userId || !assetCode || !amount || !itemName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, assetCode, amount, itemName',
        timestamp: new Date().toISOString()
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive',
        timestamp: new Date().toISOString()
      });
    }

    const result = await walletService.spendCredits(
      parseInt(userId),
      assetCode.toUpperCase(),
      parseInt(amount),
      itemName,
      idempotencyKey
    );

    const statusCode = result.isDuplicate ? 409 : 200;

    res.status(statusCode).json({
      success: true,
      isDuplicate: result.isDuplicate,
      message: result.message || 'Purchase successful',
      data: result.transaction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// HISTORY & AUDIT ENDPOINTS
// ============================================================================

/**
 * GET /api/transactions/history/:userId/:assetCode
 * Get transaction history for a wallet
 * Query params: limit=50, offset=0
 */
app.get('/api/transactions/history/:userId/:assetCode', async (req, res) => {
  try {
    const { userId, assetCode } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const history = await walletService.getTransactionHistory(
      parseInt(userId),
      assetCode.toUpperCase(),
      limit,
      offset
    );

    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/audit/validate/:walletId
 * Validate wallet state (for audit/debugging)
 */
app.get('/api/audit/validate/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    const validation = await walletService.validateWalletState(parseInt(walletId));

    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Wallet Service running on http://localhost:${PORT}`);
        console.log('Available endpoints:');
        console.log('  GET  /health');
        console.log('  GET  /api/wallets/:userId');
        console.log('  GET  /api/wallets/:userId/:assetCode');
        console.log('  POST /api/transactions/topup');
        console.log('  POST /api/transactions/bonus');
        console.log('  POST /api/transactions/spend');
        console.log('  GET  /api/transactions/history/:userId/:assetCode');
        console.log('  GET  /api/audit/validate/:walletId');
      });
      server.on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
      });
    })
    .catch(err => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = app;
