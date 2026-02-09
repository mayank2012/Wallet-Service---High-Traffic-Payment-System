# Quick Start Guide

Get the wallet service up and running in 5 minutes!

## Prerequisites

- **Node.js 14+** - [Download](https://nodejs.org/)
- **PostgreSQL 12+** - [Download](https://www.postgresql.org/download/)

## Installation

### Step 1: Clone/Download the Repository

```bash
cd "balance chek"
```

### Step 2: Run Setup Script

#### On Linux/macOS:
```bash
chmod +x setup.sh
./setup.sh
```

#### On Windows (PowerShell):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup.ps1
```

#### Manual Setup (if scripts don't work):
```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Setup database
npm run db:setup

# Seed sample data
npm run db:seed
```

### Step 3: Start the Server

```bash
npm start
```

You should see:
```
Wallet Service running on http://localhost:3000
Available endpoints:
  GET  /health
  GET  /api/wallets/:userId
  ...
```

### Step 4: Test the API

In another terminal:

```bash
node scripts/test-api.js
```

This runs through all core operations and verifies everything works.

## API Quick Examples

### Check Balance

```bash
curl http://localhost:3000/api/wallets/1/GOLD
```

### Top-Up Wallet

```bash
curl -X POST http://localhost:3000/api/transactions/topup \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "assetCode": "GOLD",
    "amount": 500,
    "orderId": "order-123"
  }'
```

### Spend Credits

```bash
curl -X POST http://localhost:3000/api/transactions/spend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "assetCode": "GOLD",
    "amount": 100,
    "itemName": "Sword"
  }'
```

### Get Transaction History

```bash
curl "http://localhost:3000/api/transactions/history/1/GOLD?limit=10"
```

## Sample Users (From Seed Data)

| Username | User ID | Gold | Diamonds | Loyalty Points |
|----------|---------|------|----------|----------------|
| player_alice | 1 | 5000 | 100 | 500 |
| player_bob | 2 | 3000 | 50 | 300 |
| player_charlie | 3 | 7000 | 200 | 1000 |

## Database Connection Issues?

If you get a database connection error:

1. **Check PostgreSQL is running:**
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. **Update .env with correct credentials:**
   ```env
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=wallet_service
   ```

3. **Reset database (loses all data):**
   ```bash
   dropdb wallet_service
   npm run db:setup
   npm run db:seed
   ```

## Key Features Demonstrated

✓ **ACID Transactions** - All operations are fully transactional  
✓ **Concurrency Handling** - Multiple simultaneous requests handled safely  
✓ **Idempotency** - Duplicate requests safely detected  
✓ **Data Integrity** - Balance constraints enforced at DB level  
✓ **Audit Trail** - Complete transaction history maintained  
✓ **Error Handling** - Graceful error messages for validation failures  

## Full Documentation

- [README.md](README.md) - Comprehensive API documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed concurrency strategies and design patterns
- [API Endpoints](README.md#-api-reference) - All available endpoints with examples

## Troubleshooting

**Port 3000 already in use?**
```bash
# Use different port
PORT=3001 npm start
```

**Database already exists?**
```bash
# The script checks and won't overwrite existing data
npm run db:seed
```

**Need to test concurrency?**

The architecture document includes test scenarios. Try:
```javascript
// Make concurrent requests with same wallet
Promise.all([
  fetch('http://localhost:3000/api/transactions/spend', {...}),
  fetch('http://localhost:3000/api/transactions/spend', {...})
])
```

## Support

Refer to the detailed documentation:
- [README.md](README.md) - Complete API reference
- [ARCHITECTURE.md](ARCHITECTURE.md) - Design patterns and concurrency strategies

Enjoy! 🚀
