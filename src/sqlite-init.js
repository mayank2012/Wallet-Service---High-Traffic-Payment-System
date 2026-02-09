// SQLite database schema initialization
const { dbRun, dbGet, dbAll, initDb } = require('./sqlite-db');

async function initializeDatabase() {
  try {
    console.log('Initializing SQLite database...');
    
    // Initialize database connection
    await initDb();

    // Create asset_types table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS asset_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        decimals INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ asset_types table created');

    // Create users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        user_type TEXT DEFAULT 'regular',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ users table created');

    // Create wallets table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        asset_id INTEGER NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
        version INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, asset_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (asset_id) REFERENCES asset_types(id)
      )
    `);
    console.log('✓ wallets table created');

    // Create transactions table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT UNIQUE,
        wallet_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'completed',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      )
    `);
    console.log('✓ transactions table created');

    // Create wallet_history table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wallet_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INTEGER NOT NULL,
        balance INTEGER NOT NULL,
        version INTEGER NOT NULL,
        transaction_id INTEGER,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      )
    `);
    console.log('✓ wallet_history table created');

    // Create indexes
    await dbRun('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_wallets_asset_id ON wallets(asset_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON transactions(idempotency_key)');
    console.log('✓ Indexes created');

    // Seed data
    await seedData();

    console.log('✅ Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

async function seedData() {
  try {
    // Check if data already exists
    const assetCount = await dbGet('SELECT COUNT(*) as count FROM asset_types');
    if (assetCount.count > 0) {
      console.log('✓ Data already seeded, skipping...');
      return;
    }

    console.log('Seeding initial data...');

    // Insert asset types
    await dbRun('INSERT INTO asset_types (code, name, description, decimals) VALUES (?, ?, ?, ?)',
      ['GOLD', 'Gold Coins', 'Primary in-game currency', 0]);
    await dbRun('INSERT INTO asset_types (code, name, description, decimals) VALUES (?, ?, ?, ?)',
      ['DIAMONDS', 'Diamonds', 'Premium currency for special items', 0]);
    await dbRun('INSERT INTO asset_types (code, name, description, decimals) VALUES (?, ?, ?, ?)',
      ['LOYALTY_POINTS', 'Loyalty Points', 'Points earned through rewards program', 0]);
    console.log('✓ Asset types seeded');

    // Insert users
    await dbRun('INSERT INTO users (username, email, display_name, user_type) VALUES (?, ?, ?, ?)',
      ['system_treasury', 'system@wallet.internal', 'Treasury Account', 'system']);
    await dbRun('INSERT INTO users (username, email, display_name, user_type) VALUES (?, ?, ?, ?)',
      ['system_vault', 'vault@wallet.internal', 'Vault Account', 'system']);
    await dbRun('INSERT INTO users (username, email, display_name, user_type) VALUES (?, ?, ?, ?)',
      ['player_alice', 'alice@example.com', 'Alice Thompson', 'regular']);
    await dbRun('INSERT INTO users (username, email, display_name, user_type) VALUES (?, ?, ?, ?)',
      ['player_bob', 'bob@example.com', 'Bob Wilson', 'regular']);
    await dbRun('INSERT INTO users (username, email, display_name, user_type) VALUES (?, ?, ?, ?)',
      ['player_charlie', 'charlie@example.com', 'Charlie Davis', 'regular']);
    console.log('✓ Users seeded');

    // Get IDs for wallet creation
    const alice = await dbGet('SELECT id FROM users WHERE username = ?', ['player_alice']);
    const bob = await dbGet('SELECT id FROM users WHERE username = ?', ['player_bob']);
    const charlie = await dbGet('SELECT id FROM users WHERE username = ?', ['player_charlie']);
    const treasury = await dbGet('SELECT id FROM users WHERE username = ?', ['system_treasury']);
    const vault = await dbGet('SELECT id FROM users WHERE username = ?', ['system_vault']);

    const gold = await dbGet('SELECT id FROM asset_types WHERE code = ?', ['GOLD']);
    const diamonds = await dbGet('SELECT id FROM asset_types WHERE code = ?', ['DIAMONDS']);
    const loyalty = await dbGet('SELECT id FROM asset_types WHERE code = ?', ['LOYALTY_POINTS']);

    // Create wallets with initial balances
    // Treasury wallets
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [treasury.id, gold.id, 1000000, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [treasury.id, diamonds.id, 100000, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [treasury.id, loyalty.id, 5000000, 0]);

    // Vault wallets
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [vault.id, gold.id, 0, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [vault.id, diamonds.id, 0, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [vault.id, loyalty.id, 0, 0]);

    // User wallets
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [alice.id, gold.id, 5000, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [alice.id, diamonds.id, 100, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [alice.id, loyalty.id, 500, 0]);

    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [bob.id, gold.id, 3000, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [bob.id, diamonds.id, 50, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [bob.id, loyalty.id, 300, 0]);

    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [charlie.id, gold.id, 7000, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [charlie.id, diamonds.id, 200, 0]);
    await dbRun('INSERT INTO wallets (user_id, asset_id, balance, version) VALUES (?, ?, ?, ?)',
      [charlie.id, loyalty.id, 1000, 0]);

    console.log('✓ Wallets seeded with initial balances');
    console.log('  - Alice: 5000 Gold, 100 Diamonds, 500 Loyalty Points');
    console.log('  - Bob: 3000 Gold, 50 Diamonds, 300 Loyalty Points');
    console.log('  - Charlie: 7000 Gold, 200 Diamonds, 1000 Loyalty Points');

  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };
