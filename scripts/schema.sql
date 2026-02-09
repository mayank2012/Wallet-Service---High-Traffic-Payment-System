-- ============================================================================
-- Wallet Service Schema
-- ============================================================================
-- This schema implements a robust, ACID-compliant wallet system for tracking
-- user balances of virtual currency (e.g., Gold Coins, Reward Points).

-- ============================================================================
-- Asset Types Table
-- ============================================================================
-- Defines the types of virtual currency supported by the system
CREATE TABLE IF NOT EXISTS asset_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    decimals INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Users Table
-- ============================================================================
-- Stores user information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    user_type VARCHAR(50) DEFAULT 'regular', -- 'regular', 'system'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Wallets Table
-- ============================================================================
-- Tracks user wallets for each asset type with version control for optimistic locking
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    asset_id INT NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    version INT NOT NULL DEFAULT 0, -- For optimistic locking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, asset_id)
);

-- Create index for quick wallet lookups
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_asset_id ON wallets(asset_id);

-- ============================================================================
-- Transactions Table (Ledger)
-- ============================================================================
-- Immutable ledger of all wallet transactions
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE, -- For idempotency
    wallet_id INT NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL, -- 'topup', 'bonus', 'purchase', 'system_debit', 'system_credit'
    amount BIGINT NOT NULL CHECK (amount != 0),
    reason VARCHAR(255),
    related_transaction_id INT REFERENCES transactions(id),
    metadata JSONB,
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'reversed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transaction lookups
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================================================
-- Transaction Pairs Table
-- ============================================================================
-- Records matched pairs of transactions (e.g., debit from one wallet, credit to another)
-- for maintaining consistency in double-entry bookkeeping
CREATE TABLE IF NOT EXISTS transaction_pairs (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE,
    debit_transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    credit_transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_pairs_debit_id ON transaction_pairs(debit_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_pairs_credit_id ON transaction_pairs(credit_transaction_id);

-- ============================================================================
-- Wallet History (Audit Trail)
-- ============================================================================
-- Maintains historical snapshots of wallet balances
CREATE TABLE IF NOT EXISTS wallet_history (
    id SERIAL PRIMARY KEY,
    wallet_id INT NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    balance BIGINT NOT NULL,
    version INT NOT NULL,
    transaction_id INT REFERENCES transactions(id),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_history_wallet_id ON wallet_history(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_history_recorded_at ON wallet_history(recorded_at);
