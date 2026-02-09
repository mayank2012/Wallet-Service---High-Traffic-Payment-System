# Project Structure & File Guide

## 📁 Directory Layout

```
balance chek/
├── src/                          # Application source code
│   ├── server.js                 # Express API server & routes
│   ├── walletService.js          # Core wallet business logic
│   └── db.js                     # PostgreSQL connection pool
│
├── scripts/                      # Database & utility scripts
│   ├── schema.sql                # Database schema definition
│   ├── seed.sql                  # Initial data seeding
│   ├── db-setup.js               # Database initialization script
│   └── test-api.js               # Automated API testing
│
├── package.json                  # Node.js dependencies & scripts
├── .env.example                  # Environment template
├── .gitignore                    # Git exclusions
│
├── README.md                     # Complete API documentation
├── QUICKSTART.md                 # Quick start guide (5 minutes)
├── ARCHITECTURE.md               # Concurrency & design patterns
│
├── setup.sh                      # Linux/macOS setup script
├── setup.ps1                     # Windows PowerShell setup
└── examples.sh                   # Example curl commands
```

## 📄 File Descriptions

### Core Application Files

#### `src/server.js` (220 lines)
**Express.js HTTP server with RESTful endpoints**

Provides:
- Health check endpoint
- Wallet balance queries
- Transaction endpoints (topup, bonus, spend)
- Transaction history & pagination
- Wallet validation endpoint
- Error handling middleware

Key Routes:
- `GET /health` - Service status
- `GET /api/wallets/:userId` - All user wallets
- `GET /api/wallets/:userId/:assetCode` - Single wallet balance
- `POST /api/transactions/topup` - Purchase credits
- `POST /api/transactions/bonus` - Issue bonus
- `POST /api/transactions/spend` - Spend credits
- `GET /api/transactions/history/:userId/:assetCode` - Transaction history
- `GET /api/audit/validate/:walletId` - Validate wallet state

#### `src/walletService.js` (280 lines)
**Core business logic with concurrency control**

Implements:
- `getWalletBalance()` - Retrieve single wallet
- `getAllWallets()` - Retrieve all user wallets
- `topupWallet()` - User purchases credits
- `issueBonus()` - System issues free credits
- `spendCredits()` - User spends credits on item
- `getTransactionHistory()` - Fetch transaction history with pagination
- `validateWalletState()` - Audit wallet integrity

Features:
- **Row-Level Locking**: Uses `FOR UPDATE` to prevent race conditions
- **Idempotency**: Duplicate transactions detected via unique keys
- **ACID Transactions**: All-or-nothing guarantees
- **Versioning**: Tracks wallet change history

#### `src/db.js` (20 lines)
**PostgreSQL connection pool configuration**

- Connection pooling (max 20 connections)
- Environment-based credentials
- Error handling for idle connections

### Database Files

#### `scripts/schema.sql` (150 lines)
**Complete database schema with ACID constraints**

Tables:
- `asset_types` - Currency types (Gold, Diamonds, Loyalty Points)
- `users` - User accounts (regular & system)
- `wallets` - User wallets per asset with versioning
- `transactions` - Immutable transaction ledger
- `transaction_pairs` - Double-entry bookkeeping pairs
- `wallet_history` - Audit trail of balance changes

Constraints:
- `CHECK (balance >= 0)` - No negative balances
- `UNIQUE(user_id, asset_id)` - One wallet per user/asset
- `UNIQUE(idempotency_key)` - No duplicate transactions
- Foreign keys for referential integrity
- Indexes for query performance

#### `scripts/seed.sql` (140 lines)
**Initial data population**

Inserts:
- 3 Asset Types (Gold, Diamonds, Loyalty Points)
- 2 System Accounts (Treasury, Vault)
- 3 Regular Users (Alice, Bob, Charlie)
- Initial balances for all users
- Audit trail entries

Result:
- Alice: 5000 Gold, 100 Diamonds, 500 Loyalty Points
- Bob: 3000 Gold, 50 Diamonds, 300 Loyalty Points
- Charlie: 7000 Gold, 200 Diamonds, 1000 Loyalty Points

#### `scripts/db-setup.js` (60 lines)
**Database initialization script**

Runs automatically with `npm run db:setup`:
- Creates `wallet_service` database if needed
- Executes schema.sql to set up tables
- Creates all indexes
- Ready for seeding

Usage:
```bash
npm run db:setup
```

### Testing & Documentation

#### `scripts/test-api.js` (180 lines)
**Automated API test suite**

Tests:
1. Health check
2. Get all wallets
3. Get single wallet balance
4. Top-up wallet
5. Issue bonus (with duplicate detection)
6. Spend credits
7. Insufficient balance error
8. Transaction history
9. Wallet validation

Runs with:
```bash
node scripts/test-api.js
```

#### `README.md` (900+ lines)
**Comprehensive documentation**

Covers:
- Features & capabilities
- Technology stack justification
- Prerequisites & installation
- Quick start (5 steps)
- Complete API reference with examples
- All error cases
- Concurrency handling explanation
- Troubleshooting
- Testing procedures
- Database schema highlights
- Monitoring & debugging queries
- Production deployment considerations

#### `ARCHITECTURE.md` (800+ lines)
**Deep dive into design patterns**

Explains:
- System architecture diagram
- Transaction flow (step-by-step)
- Race condition scenarios
- Lock types & isolation levels
- Optimistic vs. pessimistic locking
- ACID guarantees
- Performance implications
- Monitoring queries
- Lock contention handling

#### `QUICKSTART.md` (100 lines)
**5-minute quick start guide**

Includes:
- Prerequisites
- Step-by-step setup
- First API calls
- Sample users
- Troubleshooting tips
- Reference to detailed docs

### Configuration & Setup

#### `package.json` (35 lines)
**Node.js project configuration**

Dependencies:
- `express` - Web framework
- `pg` - PostgreSQL client
- `uuid` - ID generation
- `dotenv` - Environment variables

Scripts:
- `npm start` - Run server
- `npm dev` - Run with nodemon (auto-reload)
- `npm run db:setup` - Initialize database
- `npm run db:seed` - Populate sample data

#### `.env.example` (10 lines)
**Environment variables template**

Configure:
- Database credentials
- Database host/port/name
- Server port
- Logging level

#### `setup.sh` (40 lines)
**Linux/macOS setup script**

Performs:
1. Checks PostgreSQL is running
2. Creates .env from template
3. Installs npm dependencies
4. Runs database setup
5. Seeds initial data

#### `setup.ps1` (50 lines)
**Windows PowerShell setup script**

Same as setup.sh but for Windows PowerShell

#### `examples.sh` (200 lines)
**Example API calls (curl commands)**

Demonstrates:
- Health checks
- Balance queries
- Top-up transactions
- Bonus issuance
- Spend transactions
- Error cases
- Idempotency testing
- Transaction history
- Wallet validation

Copy-paste ready!

## 🔄 Data Flow

```
User Request
    │
    ▼
Express Server (src/server.js)
    │ Validate input
    ▼
Wallet Service (src/walletService.js)
    │ Check for duplicates
    │ Lock wallet row
    ▼
PostgreSQL (scripts/schema.sql)
    │ Insert transaction
    │ Update balance
    │ Record history
    ▼
Response to User
```

## 🚀 Running the Service

### Setup (First Time)
```bash
# Choose your OS:
# Linux/macOS:
./setup.sh

# Windows:
.\setup.ps1

# Or manually:
npm install
npm run db:setup
npm run db:seed
```

### Start Server
```bash
npm start
# Server runs on http://localhost:3000
```

### Test API
```bash
node scripts/test-api.js
# Or use examples:
chmod +x examples.sh
./examples.sh
```

## 📊 Database Schema Relationships

```
users (1) ←──── (many) wallets (1) ←──── (many) transactions
            user_id                   wallet_id

        ←──── (many) wallet_history
                   wallet_id

asset_types (1) ←──── (many) wallets
            asset_id

transaction_pairs connects pairs of transactions
(debit_transaction_id, credit_transaction_id)
```

## 🔐 Security & Data Integrity

### Constraints (Enforced at DB Level)
- `balance >= 0` - No negative balances
- `UNIQUE idempotency_key` - No duplicate transactions
- `UNIQUE (user_id, asset_id)` - One wallet per user/asset
- Foreign key constraints - Referential integrity

### Concurrency Control
- Row-level locking (`FOR UPDATE`)
- ACID transactions
- Optimistic versioning (secondary)

### Audit Trail
- All transactions recorded immutably
- Balance history maintained
- Timestamp on every operation
- User identification

## 📈 Scalability

### Horizontal Scaling
- Multiple Node.js servers can share PostgreSQL
- Connection pooling handled per instance
- Database handles concurrent locking

### Indexes
- `wallets(user_id)` - Fast user lookups
- `wallets(asset_id)` - Fast asset lookups
- `transactions(wallet_id)` - Fast transaction queries
- `transactions(created_at)` - Fast history queries
- `transactions(idempotency_key)` - Duplicate detection

### Performance
- Lock wait time for high-traffic wallets: ~milliseconds
- Database query time: ~milliseconds
- Network latency: dominant factor

## 🔍 Debugging Tips

### Check Database State
```bash
psql -U postgres -d wallet_service
SELECT * FROM wallets;
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20;
```

### View Server Logs
```bash
npm start
# Logs to console in real-time
```

### Test Specific Endpoint
```bash
curl http://localhost:3000/api/wallets/1/GOLD
```

### Validate Data Integrity
```bash
curl http://localhost:3000/api/audit/validate/1
```

## 📚 Documentation Map

| Document | Purpose | Read Time |
|----------|---------|-----------|
| QUICKSTART.md | Get started in 5 minutes | 5 min |
| README.md | Complete API reference | 30 min |
| ARCHITECTURE.md | Design patterns & concurrency | 45 min |
| examples.sh | Copy-paste API calls | 2 min |
| This file | Project structure | 10 min |

---

**Start with QUICKSTART.md, then refer to README.md for detailed API docs.**
