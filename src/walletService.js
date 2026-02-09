// Wallet Service - Core business logic
const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

/**
 * WalletService handles all wallet operations including transactions,
 * balance checks, and maintains ACID compliance with proper locking strategies.
 */
class WalletService {
  /**
   * Get user's wallet balance for a specific asset
   * @param {number} userId - User ID
   * @param {string} assetCode - Asset code (e.g., 'GOLD', 'DIAMONDS')
   * @returns {Promise<Object>} Wallet information with balance
   */
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
      WHERE w.user_id = $1 AND a.code = $2
    `;

    const result = await pool.query(query, [userId, assetCode]);
    if (result.rows.length === 0) {
      throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
    }

    return result.rows[0];
  }

  /**
   * Get all wallets for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of wallet objects
   */
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
      WHERE w.user_id = $1
      ORDER BY a.code
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Top-up wallet - User purchases credits with real money
   * Uses idempotency key to prevent duplicate purchases
   * @param {number} userId - User ID
   * @param {string} assetCode - Asset code
   * @param {number} amount - Amount to top-up (must be positive)
   * @param {string} idempotencyKey - Unique key for this transaction (for idempotency)
   * @param {string} orderId - Related order/payment ID
   * @returns {Promise<Object>} Transaction result
   */
  async topupWallet(userId, assetCode, amount, idempotencyKey, orderId) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check for duplicate transaction (idempotency)
      const existingTx = await client.query(
        `SELECT id, amount, status, created_at FROM transactions WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (existingTx.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          isDuplicate: true,
          transaction: existingTx.rows[0],
          message: 'Transaction already processed'
        };
      }

      // Get wallet with row-level lock
      const walletResult = await client.query(
        `SELECT w.id, w.balance, w.version, a.id as asset_id
         FROM wallets w
         JOIN asset_types a ON w.asset_id = a.id
         WHERE w.user_id = $1 AND a.code = $2
         FOR UPDATE`,
        [userId, assetCode]
      );

      if (walletResult.rows.length === 0) {
        throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
      }

      const wallet = walletResult.rows[0];

      // Create transaction record
      const txResult = await client.query(
        `INSERT INTO transactions 
         (idempotency_key, wallet_id, transaction_type, amount, reason, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, wallet_id, amount, status, created_at`,
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

      const transaction = txResult.rows[0];

      // Update wallet balance and version
      const newBalance = wallet.balance + amount;
      const newVersion = wallet.version + 1;

      await client.query(
        `UPDATE wallets 
         SET balance = $1, version = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND version = $4`,
        [newBalance, newVersion, wallet.id, wallet.version]
      );

      // Record in wallet history
      await client.query(
        `INSERT INTO wallet_history (wallet_id, balance, version, transaction_id)
         VALUES ($1, $2, $3, $4)`,
        [wallet.id, newBalance, newVersion, transaction.id]
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Issue bonus/incentive credits to user
   * System credits without real money exchange
   * @param {number} userId - User ID
   * @param {string} assetCode - Asset code
   * @param {number} amount - Amount to credit
   * @param {string} reason - Reason for bonus
   * @param {string} idempotencyKey - Unique key for idempotency
   * @returns {Promise<Object>} Transaction result
   */
  async issueBonus(userId, assetCode, amount, reason, idempotencyKey) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check for duplicate transaction
      const existingTx = await client.query(
        `SELECT id, amount, status, created_at FROM transactions WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (existingTx.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          isDuplicate: true,
          transaction: existingTx.rows[0],
          message: 'Bonus already issued'
        };
      }

      // Get wallet with lock
      const walletResult = await client.query(
        `SELECT w.id, w.balance, w.version, a.id as asset_id
         FROM wallets w
         JOIN asset_types a ON w.asset_id = a.id
         WHERE w.user_id = $1 AND a.code = $2
         FOR UPDATE`,
        [userId, assetCode]
      );

      if (walletResult.rows.length === 0) {
        throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
      }

      const wallet = walletResult.rows[0];

      // Create bonus transaction
      const txResult = await client.query(
        `INSERT INTO transactions 
         (idempotency_key, wallet_id, transaction_type, amount, reason, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, wallet_id, amount, status, created_at`,
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

      const transaction = txResult.rows[0];

      // Update wallet
      const newBalance = wallet.balance + amount;
      const newVersion = wallet.version + 1;

      await client.query(
        `UPDATE wallets 
         SET balance = $1, version = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND version = $4`,
        [newBalance, newVersion, wallet.id, wallet.version]
      );

      // Record history
      await client.query(
        `INSERT INTO wallet_history (wallet_id, balance, version, transaction_id)
         VALUES ($1, $2, $3, $4)`,
        [wallet.id, newBalance, newVersion, transaction.id]
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Spend/Purchase from wallet
   * Deducts credits when user buys an in-app item
   * Uses optimistic locking to prevent race conditions
   * @param {number} userId - User ID
   * @param {string} assetCode - Asset code
   * @param {number} amount - Amount to spend (must be positive)
   * @param {string} itemName - Item being purchased
   * @param {string} idempotencyKey - Unique key for idempotency
   * @returns {Promise<Object>} Transaction result
   */
  async spendCredits(userId, assetCode, amount, itemName, idempotencyKey) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check for duplicate transaction
      const existingTx = await client.query(
        `SELECT id, amount, status, created_at FROM transactions WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (existingTx.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          isDuplicate: true,
          transaction: existingTx.rows[0],
          message: 'Purchase already processed'
        };
      }

      // Get wallet with lock
      const walletResult = await client.query(
        `SELECT w.id, w.balance, w.version, a.id as asset_id
         FROM wallets w
         JOIN asset_types a ON w.asset_id = a.id
         WHERE w.user_id = $1 AND a.code = $2
         FOR UPDATE`,
        [userId, assetCode]
      );

      if (walletResult.rows.length === 0) {
        throw new Error(`Wallet not found for user ${userId} and asset ${assetCode}`);
      }

      const wallet = walletResult.rows[0];

      // Check if sufficient balance
      if (wallet.balance < amount) {
        await client.query('ROLLBACK');
        throw new Error(
          `Insufficient balance. Required: ${amount}, Available: ${wallet.balance}`
        );
      }

      // Create debit transaction
      const txResult = await client.query(
        `INSERT INTO transactions 
         (idempotency_key, wallet_id, transaction_type, amount, reason, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, wallet_id, amount, status, created_at`,
        [
          idempotencyKey,
          wallet.id,
          'purchase',
          -amount, // Negative for debit
          `Purchase: ${itemName}`,
          'completed',
          JSON.stringify({ userId, assetCode, itemName })
        ]
      );

      const transaction = txResult.rows[0];

      // Update wallet balance
      const newBalance = wallet.balance - amount;
      const newVersion = wallet.version + 1;

      await client.query(
        `UPDATE wallets 
         SET balance = $1, version = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND version = $4`,
        [newBalance, newVersion, wallet.id, wallet.version]
      );

      // Record history
      await client.query(
        `INSERT INTO wallet_history (wallet_id, balance, version, transaction_id)
         VALUES ($1, $2, $3, $4)`,
        [wallet.id, newBalance, newVersion, transaction.id]
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction history for a wallet
   * @param {number} userId - User ID
   * @param {string} assetCode - Asset code
   * @param {number} limit - Number of records to fetch
   * @param {number} offset - Pagination offset
   * @returns {Promise<Object>} Transaction history with pagination info
   */
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
      WHERE w.user_id = $1 AND a.code = $2
      ORDER BY t.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      JOIN asset_types a ON w.asset_id = a.id
      WHERE w.user_id = $1 AND a.code = $2
    `;

    const [historyResult, countResult] = await Promise.all([
      pool.query(query, [userId, assetCode, limit, offset]),
      pool.query(countQuery, [userId, assetCode])
    ]);

    return {
      transactions: historyResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
      hasMore: offset + limit < parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Validate wallet state for debugging/audit
   * Ensures balance matches sum of transactions
   * @param {number} walletId - Wallet ID
   * @returns {Promise<Object>} Validation result
   */
  async validateWalletState(walletId) {
    const walletResult = await pool.query(
      `SELECT balance FROM wallets WHERE id = $1`,
      [walletId]
    );

    if (walletResult.rows.length === 0) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const walletBalance = walletResult.rows[0].balance;

    const txResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as calculated_balance
       FROM transactions
       WHERE wallet_id = $1 AND status = 'completed'`,
      [walletId]
    );

    const calculatedBalance = parseInt(txResult.rows[0].calculated_balance);

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
