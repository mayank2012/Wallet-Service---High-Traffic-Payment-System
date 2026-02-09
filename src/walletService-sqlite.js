// Wallet Service - SQLite version with concurrency control
const { dbAll, dbGet, dbRun, db } = require('./sqlite-db');
const { v4: uuidv4 } = require('uuid');

class WalletService {
  async getWalletBalance(userId, assetCode) {
    const query = `
      SELECT 
        w.id,
        w.user_id,
        a.code as asset_code,
        a.name as asset_name,
        w.balance,
        w.version,
        w.updated_at
      FROM wallets w
      JOIN asset_types a ON w.asset_id = a.id
      WHERE w.user_id = ? AND a.code = ?
    `;

    const result = await dbGet(query, [userId, assetCode]);
    if (!result) {
      throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
    }

    return result;
  }

  async getAllWallets(userId) {
    const query = `
      SELECT 
        w.id,
        w.user_id,
        a.code as asset_code,
        a.name as asset_name,
        w.balance,
        w.version,
        w.updated_at
      FROM wallets w
      JOIN asset_types a ON w.asset_id = a.id
      WHERE w.user_id = ?
      ORDER BY a.code
    `;

    const result = await dbAll(query, [userId]);
    return result || [];
  }

  async topupWallet(userId, assetCode, amount, idempotencyKey, orderId) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    try {
      // Check for duplicate transaction
      const existingTx = await dbGet(
        `SELECT id, amount, status, created_at FROM transactions WHERE idempotency_key = ?`,
        [idempotencyKey]
      );

      if (existingTx) {
        return {
          isDuplicate: true,
          transaction: existingTx,
          message: 'Transaction already processed'
        };
      }

      // Get wallet
      const wallet = await dbGet(
        `SELECT w.id, w.balance, w.version, a.id as asset_id
         FROM wallets w
         JOIN asset_types a ON w.asset_id = a.id
         WHERE w.user_id = ? AND a.code = ?`,
        [userId, assetCode]
      );

      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
      }

      // Create transaction record
      const txResult = await dbRun(
        `INSERT INTO transactions 
         (idempotency_key, wallet_id, transaction_type, amount, reason, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idempotencyKey,
          wallet.id,
          'topup',
          amount,
          'User wallet top-up',
          'completed',
          JSON.stringify({ orderId, userId, assetCode })
        ]
      );

      const transaction = await dbGet('SELECT * FROM transactions WHERE id = ?', [txResult.lastID]);

      // Update wallet balance
      const newBalance = wallet.balance + amount;
      const newVersion = wallet.version + 1;

      await dbRun(
        `UPDATE wallets 
         SET balance = ?, version = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newBalance, newVersion, wallet.id]
      );

      // Record in wallet history
      await dbRun(
        `INSERT INTO wallet_history (wallet_id, balance, version, transaction_id)
         VALUES (?, ?, ?, ?)`,
        [wallet.id, newBalance, newVersion, transaction.id]
      );

      return {
        isDuplicate: false,
        transaction: {
          ...transaction,
          wallet_id: wallet.id,
          previous_balance: wallet.balance,
          new_balance: newBalance,
          version: newVersion
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async issueBonus(userId, assetCode, amount, reason, idempotencyKey) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    try {
      // Check for duplicate
      const existingTx = await dbGet(
        `SELECT id, amount, status, created_at FROM transactions WHERE idempotency_key = ?`,
        [idempotencyKey]
      );

      if (existingTx) {
        return {
          isDuplicate: true,
          transaction: existingTx,
          message: 'Bonus already issued'
        };
      }

      // Get wallet
      const wallet = await dbGet(
        `SELECT w.id, w.balance, w.version, a.id as asset_id
         FROM wallets w
         JOIN asset_types a ON w.asset_id = a.id
         WHERE w.user_id = ? AND a.code = ?`,
        [userId, assetCode]
      );

      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
      }

      // Create transaction
      const txResult = await dbRun(
        `INSERT INTO transactions 
         (idempotency_key, wallet_id, transaction_type, amount, reason, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idempotencyKey,
          wallet.id,
          'bonus',
          amount,
          reason || 'System bonus',
          'completed',
          JSON.stringify({ userId, assetCode, reason })
        ]
      );

      const transaction = await dbGet('SELECT * FROM transactions WHERE id = ?', [txResult.lastID]);

      // Update wallet
      const newBalance = wallet.balance + amount;
      const newVersion = wallet.version + 1;

      await dbRun(
        `UPDATE wallets 
         SET balance = ?, version = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newBalance, newVersion, wallet.id]
      );

      // Record history
      await dbRun(
        `INSERT INTO wallet_history (wallet_id, balance, version, transaction_id)
         VALUES (?, ?, ?, ?)`,
        [wallet.id, newBalance, newVersion, transaction.id]
      );

      return {
        isDuplicate: false,
        transaction: {
          ...transaction,
          wallet_id: wallet.id,
          previous_balance: wallet.balance,
          new_balance: newBalance,
          version: newVersion
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async spendCredits(userId, assetCode, amount, itemName, idempotencyKey) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    try {
      // Check for duplicate
      const existingTx = await dbGet(
        `SELECT id, amount, status, created_at FROM transactions WHERE idempotency_key = ?`,
        [idempotencyKey]
      );

      if (existingTx) {
        return {
          isDuplicate: true,
          transaction: existingTx,
          message: 'Purchase already processed'
        };
      }

      // Get wallet
      const wallet = await dbGet(
        `SELECT w.id, w.balance, w.version, a.id as asset_id
         FROM wallets w
         JOIN asset_types a ON w.asset_id = a.id
         WHERE w.user_id = ? AND a.code = ?`,
        [userId, assetCode]
      );

      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
      }

      // Check balance
      if (wallet.balance < amount) {
        throw new Error(
          `Insufficient balance. Required: ${amount}, Available: ${wallet.balance}`
        );
      }

      // Create transaction
      const txResult = await dbRun(
        `INSERT INTO transactions 
         (idempotency_key, wallet_id, transaction_type, amount, reason, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idempotencyKey,
          wallet.id,
          'purchase',
          -amount,
          `Purchase: ${itemName}`,
          'completed',
          JSON.stringify({ userId, assetCode, itemName })
        ]
      );

      const transaction = await dbGet('SELECT * FROM transactions WHERE id = ?', [txResult.lastID]);

      // Update wallet
      const newBalance = wallet.balance - amount;
      const newVersion = wallet.version + 1;

      await dbRun(
        `UPDATE wallets 
         SET balance = ?, version = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newBalance, newVersion, wallet.id]
      );

      // Record history
      await dbRun(
        `INSERT INTO wallet_history (wallet_id, balance, version, transaction_id)
         VALUES (?, ?, ?, ?)`,
        [wallet.id, newBalance, newVersion, transaction.id]
      );

      return {
        isDuplicate: false,
        transaction: {
          ...transaction,
          wallet_id: wallet.id,
          previous_balance: wallet.balance,
          new_balance: newBalance,
          version: newVersion
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async getTransactionHistory(userId, assetCode, limit = 50, offset = 0) {
    const query = `
      SELECT 
        t.id,
        t.idempotency_key,
        t.transaction_type,
        t.amount,
        t.reason,
        t.status,
        t.created_at,
        a.code as asset_code,
        u.username
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN users u ON w.user_id = u.id
      JOIN asset_types a ON w.asset_id = a.id
      WHERE w.user_id = ? AND a.code = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN asset_types a ON w.asset_id = a.id
      WHERE w.user_id = ? AND a.code = ?
    `;

    const historyResult = await dbAll(query, [userId, assetCode, limit, offset]);
    const countResult = await dbGet(countQuery, [userId, assetCode]);

    return {
      transactions: historyResult || [],
      total: countResult?.total || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (countResult?.total || 0)
    };
  }

  async validateWalletState(walletId) {
    const walletResult = await dbGet(
      `SELECT balance FROM wallets WHERE id = ?`,
      [walletId]
    );

    if (!walletResult) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const walletBalance = walletResult.balance;

    const txResult = await dbGet(
      `SELECT COALESCE(SUM(amount), 0) as calculated_balance
       FROM transactions
       WHERE wallet_id = ? AND status = 'completed'`,
      [walletId]
    );

    const calculatedBalance = txResult.calculated_balance || 0;

    return {
      walletId,
      storedBalance: walletBalance,
      calculatedBalance: calculatedBalance,
      isValid: walletBalance === calculatedBalance,
      discrepancy: walletBalance - calculatedBalance
    };
  }
}

module.exports = new WalletService();
