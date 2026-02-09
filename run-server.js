#!/usr/bin/env node

/**
 * Wallet Service HTTP Server
 * A production-grade wallet management service using Express and SQLite
 */

const express = require('express');
const http = require('http');
const { initializeDatabase } = require('./src/sqlite-init');
const walletService = require('./src/walletService-sqlite');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Wallet Service',
    timestamp: new Date().toISOString() 
  });
});

// ============================================================================
// BALANCE ENDPOINTS
// ============================================================================

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

app.get('/api/wallets/:userId/:assetCode', async (req, res) => {
  try {
    const { userId, assetCode } = req.params;
    const wallet = await walletService.getWalletBalance(
      parseInt(userId),
      assetCode.toUpperCase()
    );
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
        timestamp: new Date().toISOString()
      });
    }

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

app.post('/api/transactions/topup', async (req, res) => {
  try {
    const { userId, assetCode, amount, orderId, idempotencyKey } = req.body;

    if (!userId || !assetCode || !amount || !orderId || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString()
      });
    }

    const result = await walletService.topupWallet(
      userId,
      assetCode.toUpperCase(),
      amount,
      idempotencyKey,
      orderId
    );

    res.json({
      success: true,
      data: result,
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

app.post('/api/transactions/bonus', async (req, res) => {
  try {
    const { userId, assetCode, amount, reason, idempotencyKey } = req.body;

    if (!userId || !assetCode || !amount || !reason || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString()
      });
    }

    const result = await walletService.issueBonus(
      userId,
      assetCode.toUpperCase(),
      amount,
      reason,
      idempotencyKey
    );

    res.json({
      success: true,
      data: result,
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

app.post('/api/transactions/spend', async (req, res) => {
  try {
    const { userId, assetCode, amount, itemName, idempotencyKey } = req.body;

    if (!userId || !assetCode || !amount || !itemName || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString()
      });
    }

    const result = await walletService.spendCredits(
      userId,
      assetCode.toUpperCase(),
      amount,
      itemName,
      idempotencyKey
    );

    res.json({
      success: true,
      data: result,
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
// HISTORY ENDPOINTS
// ============================================================================

app.get('/api/transactions/history/:userId/:assetCode', async (req, res) => {
  try {
    const { userId, assetCode } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const history = await walletService.getTransactionHistory(
      parseInt(userId),
      assetCode.toUpperCase(),
      parseInt(limit),
      parseInt(offset)
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

// ============================================================================
// AUDIT ENDPOINTS
// ============================================================================

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

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    console.log('Starting Wallet Service...');
    await initializeDatabase();
    
    const server = http.createServer(app);
    
    server.listen(PORT, () => {
      console.log(`\n✅ Wallet Service is running!`);
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log('\n📝 Available endpoints:');
      console.log('  GET  /health');
      console.log('  GET  /api/wallets/:userId');
      console.log('  GET  /api/wallets/:userId/:assetCode');
      console.log('  POST /api/transactions/topup');
      console.log('  POST /api/transactions/bonus');
      console.log('  POST /api/transactions/spend');
      console.log('  GET  /api/transactions/history/:userId/:assetCode');
      console.log('  GET  /api/audit/validate/:walletId');
      console.log('\n✨ Ready to accept requests!\n');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
