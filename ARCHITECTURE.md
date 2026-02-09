# Wallet Service - Architecture & Concurrency Strategy

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│                   (Gaming App, Web Browser)                      │
└─────────────────────────────────────┬───────────────────────────┘
                                       │
                    HTTP/HTTPS Requests│
                                       │
┌─────────────────────────────────────▼───────────────────────────┐
│                    API Layer (Express.js)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Health    │  │   Wallets    │  │   Transactions       │   │
│  │   Endpoints │  │   Endpoints  │  │   Endpoints          │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│       │                  │                      │                │
│       └──────────────────┴──────────────────────┘                │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                    Transaction      │
                    Processing       │
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│              Wallet Service Layer (Business Logic)               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  topupWallet() │ issueBonus() │ spendCredits()         │    │
│  │  getBalance()  │ getHistory() │ validateState()        │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────┼───────────────────────────────────────┘
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
         │ ACID Transactions with             │
         │ Row-Level Locking                  │
         │                                    │
┌────────▼────────────────────────────────────▼─────┐
│          PostgreSQL Database                      │
│  ┌───────────────────────────────────────────┐   │
│  │  Wallets Table                            │   │
│  │  ├─ balance (NOT NULL, ≥ 0)              │   │
│  │  ├─ version (for versioning)             │   │
│  │  └─ FOR UPDATE (row locking)             │   │
│  ├───────────────────────────────────────────┤   │
│  │  Transactions Table (Immutable Ledger)    │   │
│  │  ├─ idempotency_key (UNIQUE)             │   │
│  │  ├─ amount (can be positive/negative)    │   │
│  │  └─ status (completed/failed/pending)    │   │
│  ├───────────────────────────────────────────┤   │
│  │  Wallet History (Audit Trail)             │   │
│  │  └─ Records all balance changes           │   │
│  └───────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

## Transaction Flow

### Top-Up Transaction (User Purchases Credits)

```
User initiates purchase
          │
          ▼
┌─────────────────────────────────────────────────────┐
│ 1. Client sends TOP-UP request                      │
│    {                                                │
│      userId: 1,                                     │
│      assetCode: "GOLD",                            │
│      amount: 1000,                                 │
│      orderId: "order-12345",                       │
│      idempotencyKey: "uuid-xxx"  ← Prevents dups  │
│    }                                                │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│ 2. API Server receives request                      │
│    - Validates input (amount > 0, user exists)     │
│    - Calls walletService.topupWallet()             │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│ 3. WalletService handles transaction                │
│    BEGIN TRANSACTION;                               │
│                                                    │
│    a) Check for duplicate:                         │
│       SELECT * FROM transactions                   │
│       WHERE idempotency_key = 'uuid-xxx'          │
│       → If found: ROLLBACK & return duplicate      │
│                                                    │
│    b) Lock wallet row (exclusive):                 │
│       SELECT w.id, w.balance, w.version            │
│       FROM wallets w                               │
│       WHERE w.user_id = 1 AND ...                 │
│       FOR UPDATE;  ← BLOCKS other transactions     │
│                                                    │
│    c) Record transaction in ledger:                │
│       INSERT INTO transactions                     │
│       (idempotency_key, wallet_id, amount, ...)   │
│       VALUES ('uuid-xxx', 1, 1000, ...)           │
│                                                    │
│    d) Update wallet balance:                       │
│       UPDATE wallets                               │
│       SET balance = balance + 1000,               │
│           version = version + 1                    │
│       WHERE id = 1 AND version = 5                │
│                                                    │
│    e) Record balance change in history:            │
│       INSERT INTO wallet_history                   │
│       (wallet_id, balance, version, ...)          │
│       VALUES (1, 6000, 6, ...)                    │
│                                                    │
│    COMMIT;  ← All or nothing, lock released       │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│ 4. API returns success to client                    │
│    {                                                │
│      success: true,                                │
│      isDuplicate: false,                           │
│      data: {                                        │
│        id: 42,                                     │
│        previous_balance: 5000,                     │
│        new_balance: 6000,                         │
│        version: 6                                  │
│      }                                              │
│    }                                                │
└─────────────────────────────────────────────────────┘
```

## Concurrency Handling: Real-World Scenarios

### Scenario 1: Race Condition Without Locking

**What happens WITHOUT proper concurrency control:**

```
Time  Thread 1                          Thread 2
─────────────────────────────────────────────────────────
 T1   GET wallet balance = 100
                                       GET wallet balance = 100
 T2   Spend 50 → calc: 100 - 50 = 50
                                       Spend 60 → calc: 100 - 60 = 40
 T3   UPDATE balance = 50
                                       UPDATE balance = 40
 T4   Response: 50 ✗                   Response: 40 ✗
      But total spent = 110, balance = 40
      MONEY LOST!
```

**Result: Data Inconsistency**
- Two transactions total 110 credits spent
- But balance only shows 40
- 110 - 40 = 70 credits vanished!

### Scenario 2: Concurrency WITH Row-Level Locking (PostgreSQL)

**What happens WITH FOR UPDATE locks:**

```
Time  Thread 1                          Thread 2
─────────────────────────────────────────────────────────
 T1   BEGIN;
      SELECT ... FOR UPDATE;
      (acquires exclusive lock) ✓
                                       BEGIN;
                                       SELECT ... FOR UPDATE;
                                       (WAITS for lock) ⏳
 T2   Read balance = 100
      Calculate: 100 - 50 = 50
 T3   UPDATE balance = 50
      INSERT transaction
      COMMIT;
      (releases lock) 🔓
                                       (lock acquired now) ✓
 T4                                    Read balance = 50
                                       Calculate: 50 - 60 = ERROR!
                                       (insufficient balance)
                                       ROLLBACK;
      
Result: Thread 2 failed gracefully
✓ Balance integrity maintained = 50
✓ Both transactions recorded
```

### Scenario 3: Duplicate Request Protection (Idempotency)

**Without Idempotency:**

```
User click: "Top-up 1000 Gold"
        │
        ▼
   Request #1 sent
        │
    (network lag, user thinks it failed)
        │
   User clicks again
        │
        ▼
   Request #2 sent (same request, new attempt)
        │
        ▼
Server processes #1:                 Server processes #2:
  - Balance: 5000 → 6000              - Balance: 6000 → 7000
  - User gets 2000 extra!
        
Result: Data Integrity Violated ✗
```

**With Idempotency Key:**

```
User click: "Top-up 1000 Gold"
    idempotencyKey = "uuid-abc123"
        │
        ▼
   Request #1 sent
        │
    (network lag)
        │
   User clicks again
        │
        ▼
   Request #2 sent
    (same idempotencyKey: "uuid-abc123")
        │
        ▼
Server processes #1:                 Server processes #2:
  - idempotencyKey not in DB         - Check: is "uuid-abc123" in DB?
  - CREATE transaction               - YES! Return original result
  - Balance: 5000 → 6000             - Balance stays 6000
  - STORE idempotencyKey in DB       - No update!
        
Result: Data Integrity Preserved ✓
```

## Lock Types & Isolation Levels

### PostgreSQL Lock Types

**Implicit Locks (What We Use):**
```sql
-- Row-level EXCLUSIVE lock - only one transaction can hold it
SELECT ... FROM wallets WHERE id = 1 FOR UPDATE;

-- This lock blocks other transactions from:
-- - Reading with FOR UPDATE
-- - Reading with FOR SHARE  
-- - Updating the row
-- - Deleting the row
```

**Lock Timeout:**
```
Default: 0 (wait forever)
We don't set a timeout, preferring to wait rather than fail silently
```

### Transaction Isolation Level

**What We Use: DEFAULT (READ COMMITTED in PostgreSQL)**

```
ISOLATION LEVELS (from weakest to strongest):
├─ READ UNCOMMITTED  ✗ (Too weak)
├─ READ COMMITTED    ✓ (What we use)
│  └─ Prevents: Dirty reads
│  └─ Allows: Non-repeatable reads, Phantom reads
├─ REPEATABLE READ   (PostgreSQL: actually SERIALIZABLE)
└─ SERIALIZABLE      ✓ (Could use for extra safety)
```

**Why READ COMMITTED is Sufficient:**
- We use FOR UPDATE locks for critical sections
- The lock prevents the race condition that READ COMMITTED can't prevent
- Better performance than SERIALIZABLE
- Sufficient for our use case

## Optimistic Locking (Version Field)

**Alternative Strategy (not our primary, but documented):**

```sql
-- Check version before update
UPDATE wallets
SET balance = balance + 1000,
    version = version + 1
WHERE id = 1 AND version = 5  -- Only update if version hasn't changed
RETURNING version;

-- If no rows returned: someone else updated it, retry needed
```

**When it fails:**

```
Thread 1: Read wallet, version=5, balance=5000
Thread 2: Read wallet, version=5, balance=5000
Thread 1: Update balance to 4500, set version=6
Thread 2: Try to update balance to 5500, expects version=5
          (But version is now 6!)
          → 0 rows updated, RETRY needed
```

**Why we prefer FOR UPDATE:**
- Prevents the issue from happening in the first place
- Don't need retry logic
- Clear, understandable semantics
- Better for financial transactions

## Data Integrity Guarantees

### ACID Properties

**Atomicity** ✓
```javascript
// Either ALL steps succeed or ALL rollback
BEGIN;
  INSERT transaction
  UPDATE wallet balance
  INSERT wallet_history
COMMIT;  // All succeed together, or ROLLBACK if any fails
```

**Consistency** ✓
```sql
-- Balance constraint enforced at database level
balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0)
-- Impossible to create negative balance

-- Unique constraint on idempotency_key
UNIQUE(idempotency_key)
-- Impossible to process duplicate
```

**Isolation** ✓
```sql
-- Row-level locks ensure transactions don't interfere
FOR UPDATE  -- Exclusive lock on this row
-- Other transactions must wait
```

**Durability** ✓
```sql
-- PostgreSQL writes to WAL (Write-Ahead Log) immediately
-- Data is safe even if server crashes
COMMIT;  -- Guaranteed to be on disk
```

## Performance Implications

### Lock Contention Scenarios

**High Traffic on Single Wallet:**
```
100 concurrent purchases from same user
     │  │  │  │  │
     ▼  ▼  ▼  ▼  ▼
   [Queue for wallet lock]
     │
     ▼  (only one acquires lock, others wait)
   Process transaction 1
   Release lock
     │
     ▼
   Process transaction 2
   Release lock
   ... and so on
   
Time: ~100 transactions serialize (could be seconds)
But: Data is 100% correct
```

**Mitigation Strategy:**
- Distribute users across multiple nodes (horizontal scaling)
- Each node has its own connection pool
- PostgreSQL handles load balancing
- For extremely hot wallets, consider caching + delayed persistence (advanced)

### Index Strategy

**Wallets Lookup:**
```sql
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_asset_id ON wallets(asset_id);
-- Query: SELECT ... WHERE user_id = 1 AND asset_id = 1
-- Uses both indexes via bitmap scan
```

**Transaction History:**
```sql
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
-- Query: SELECT ... WHERE wallet_id = 1 ORDER BY created_at DESC
-- Uses wallet_id index, then sorts on indexed column (fast)
```

## Monitoring Queries

### Check for Lock Waits
```sql
SELECT 
  waiting_locks.locktype,
  waiting_locks.database,
  waiting_locks.relation::regclass,
  waiting_stm.usename,
  waiting_stm.query,
  blocking_stm.query AS blocking_query
FROM pg_stat_activity AS waiting_stm
JOIN pg_locks AS waiting_locks ON waiting_stm.pid = waiting_locks.pid
JOIN pg_locks AS blocking_locks 
  ON blocking_locks.locktype = waiting_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM waiting_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM waiting_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM waiting_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM waiting_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM waiting_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM waiting_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM waiting_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM waiting_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM waiting_locks.objsubid
  AND blocking_locks.pid != waiting_locks.pid
JOIN pg_stat_activity AS blocking_stm ON blocking_stm.pid = blocking_locks.pid
WHERE NOT waiting_locks.granted;
```

### Long-Running Transactions
```sql
SELECT 
  pid,
  usename,
  query,
  query_start,
  state_change,
  state,
  AGE(now(), query_start) AS duration
FROM pg_stat_activity
WHERE query != '<idle>'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;
```

## Conclusion

The wallet service uses **PostgreSQL row-level locking (FOR UPDATE) with ACID transactions** as the primary concurrency control mechanism. This ensures:

✓ No race conditions  
✓ Data integrity guaranteed  
✓ Exactly-once semantics with idempotency keys  
✓ Clear, understandable implementation  
✓ Suitable for high-traffic, financial systems  

This approach has been battle-tested in banking systems, payment processors, and other financial institutions.
