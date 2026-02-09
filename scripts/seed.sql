-- ============================================================================
-- Seed Data for Wallet Service
-- ============================================================================
-- This script initializes the wallet service with sample data

-- ============================================================================
-- Asset Types
-- ============================================================================
INSERT INTO asset_types (code, name, description, decimals) VALUES
('GOLD', 'Gold Coins', 'Primary in-game currency', 0),
('DIAMONDS', 'Diamonds', 'Premium currency for special items', 0),
('LOYALTY_POINTS', 'Loyalty Points', 'Points earned through rewards program', 0)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- System Accounts (Treasury)
-- ============================================================================
-- Create the system/treasury account for managing currency supply
INSERT INTO users (username, email, display_name, user_type) VALUES
('system_treasury', 'system@wallet.internal', 'Treasury Account', 'system'),
('system_vault', 'vault@wallet.internal', 'Vault Account', 'system')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- Regular Users
-- ============================================================================
-- Create sample user accounts
INSERT INTO users (username, email, display_name, user_type) VALUES
('player_alice', 'alice@example.com', 'Alice Thompson', 'regular'),
('player_bob', 'bob@example.com', 'Bob Wilson', 'regular'),
('player_charlie', 'charlie@example.com', 'Charlie Davis', 'regular')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- Initialize Wallets for All Users and Asset Types
-- ============================================================================
-- Get user IDs
DO $$
DECLARE
    v_system_treasury_id INT;
    v_system_vault_id INT;
    v_alice_id INT;
    v_bob_id INT;
    v_charlie_id INT;
    v_gold_id INT;
    v_diamonds_id INT;
    v_loyalty_id INT;
BEGIN
    -- Get user IDs
    SELECT id INTO v_system_treasury_id FROM users WHERE username = 'system_treasury';
    SELECT id INTO v_system_vault_id FROM users WHERE username = 'system_vault';
    SELECT id INTO v_alice_id FROM users WHERE username = 'player_alice';
    SELECT id INTO v_bob_id FROM users WHERE username = 'player_bob';
    SELECT id INTO v_charlie_id FROM users WHERE username = 'player_charlie';

    -- Get asset IDs
    SELECT id INTO v_gold_id FROM asset_types WHERE code = 'GOLD';
    SELECT id INTO v_diamonds_id FROM asset_types WHERE code = 'DIAMONDS';
    SELECT id INTO v_loyalty_id FROM asset_types WHERE code = 'LOYALTY_POINTS';

    -- Create Treasury wallets
    INSERT INTO wallets (user_id, asset_id, balance, version)
    VALUES
        (v_system_treasury_id, v_gold_id, 1000000, 0),
        (v_system_treasury_id, v_diamonds_id, 100000, 0),
        (v_system_treasury_id, v_loyalty_id, 5000000, 0)
    ON CONFLICT (user_id, asset_id) DO NOTHING;

    -- Create Vault wallets (for system operations)
    INSERT INTO wallets (user_id, asset_id, balance, version)
    VALUES
        (v_system_vault_id, v_gold_id, 0, 0),
        (v_system_vault_id, v_diamonds_id, 0, 0),
        (v_system_vault_id, v_loyalty_id, 0, 0)
    ON CONFLICT (user_id, asset_id) DO NOTHING;

    -- Create User wallets with initial balances
    INSERT INTO wallets (user_id, asset_id, balance, version)
    VALUES
        -- Alice: 5000 Gold, 100 Diamonds, 500 Loyalty Points
        (v_alice_id, v_gold_id, 5000, 0),
        (v_alice_id, v_diamonds_id, 100, 0),
        (v_alice_id, v_loyalty_id, 500, 0),
        -- Bob: 3000 Gold, 50 Diamonds, 300 Loyalty Points
        (v_bob_id, v_gold_id, 3000, 0),
        (v_bob_id, v_diamonds_id, 50, 0),
        (v_bob_id, v_loyalty_id, 300, 0),
        -- Charlie: 7000 Gold, 200 Diamonds, 1000 Loyalty Points
        (v_charlie_id, v_gold_id, 7000, 0),
        (v_charlie_id, v_diamonds_id, 200, 0),
        (v_charlie_id, v_loyalty_id, 1000, 0)
    ON CONFLICT (user_id, asset_id) DO NOTHING;
END $$;

-- ============================================================================
-- Initial Transaction Records (Audit Trail)
-- ============================================================================
-- Record initial balance setup as system transactions
DO $$
DECLARE
    v_alice_gold_wallet_id INT;
    v_bob_gold_wallet_id INT;
    v_charlie_gold_wallet_id INT;
    v_alice_diamonds_wallet_id INT;
    v_bob_diamonds_wallet_id INT;
    v_charlie_diamonds_wallet_id INT;
    v_alice_loyalty_wallet_id INT;
    v_bob_loyalty_wallet_id INT;
    v_charlie_loyalty_wallet_id INT;
BEGIN
    -- Get wallet IDs
    SELECT id INTO v_alice_gold_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_alice' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'GOLD');

    SELECT id INTO v_bob_gold_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_bob' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'GOLD');

    SELECT id INTO v_charlie_gold_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_charlie' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'GOLD');

    SELECT id INTO v_alice_diamonds_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_alice' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'DIAMONDS');

    SELECT id INTO v_bob_diamonds_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_bob' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'DIAMONDS');

    SELECT id INTO v_charlie_diamonds_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_charlie' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'DIAMONDS');

    SELECT id INTO v_alice_loyalty_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_alice' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS');

    SELECT id INTO v_bob_loyalty_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_bob' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS');

    SELECT id INTO v_charlie_loyalty_wallet_id FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'player_charlie' AND w.asset_id = (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS');

    -- Insert initial balance transactions
    INSERT INTO transactions (wallet_id, transaction_type, amount, reason, status)
    VALUES
        (v_alice_gold_wallet_id, 'system_credit', 5000, 'Initial balance setup', 'completed'),
        (v_bob_gold_wallet_id, 'system_credit', 3000, 'Initial balance setup', 'completed'),
        (v_charlie_gold_wallet_id, 'system_credit', 7000, 'Initial balance setup', 'completed'),
        (v_alice_diamonds_wallet_id, 'system_credit', 100, 'Initial balance setup', 'completed'),
        (v_bob_diamonds_wallet_id, 'system_credit', 50, 'Initial balance setup', 'completed'),
        (v_charlie_diamonds_wallet_id, 'system_credit', 200, 'Initial balance setup', 'completed'),
        (v_alice_loyalty_wallet_id, 'system_credit', 500, 'Initial balance setup', 'completed'),
        (v_bob_loyalty_wallet_id, 'system_credit', 300, 'Initial balance setup', 'completed'),
        (v_charlie_loyalty_wallet_id, 'system_credit', 1000, 'Initial balance setup', 'completed')
    ON CONFLICT (idempotency_key) DO NOTHING;
END $$;

-- Verify data was inserted correctly
SELECT 'Asset Types:' as info;
SELECT code, name, decimals FROM asset_types ORDER BY code;

SELECT 'Users:' as info;
SELECT username, display_name, user_type FROM users ORDER BY username;

SELECT 'Wallets with Balances:' as info;
SELECT u.username, a.code, w.balance
FROM wallets w
JOIN users u ON w.user_id = u.id
JOIN asset_types a ON w.asset_id = a.id
ORDER BY u.username, a.code;
