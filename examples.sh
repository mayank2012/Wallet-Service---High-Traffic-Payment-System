#!/bin/bash

# Wallet Service - Example API Calls
# Copy and paste these commands to test the API

# Ensure the server is running: npm start

# ============================================================================
# HEALTH & STATUS
# ============================================================================

echo "=== Health Check ==="
curl -X GET http://localhost:3000/health

echo ""
echo ""

# ============================================================================
# WALLET BALANCE QUERIES
# ============================================================================

echo "=== Get All Wallets for User 1 ==="
curl -X GET http://localhost:3000/api/wallets/1

echo ""
echo ""

echo "=== Get Alice's Gold Balance ==="
curl -X GET http://localhost:3000/api/wallets/1/GOLD

echo ""
echo ""

echo "=== Get Alice's Diamond Balance ==="
curl -X GET http://localhost:3000/api/wallets/1/DIAMONDS

echo ""
echo ""

echo "=== Get Alice's Loyalty Points Balance ==="
curl -X GET http://localhost:3000/api/wallets/1/LOYALTY_POINTS

echo ""
echo ""

# ============================================================================
# TRANSACTION - TOP-UP (User Purchases)
# ============================================================================

echo "=== Top-Up Alice's Gold (1000 coins) ==="
curl -X POST http://localhost:3000/api/transactions/topup \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "assetCode": "GOLD",
    "amount": 1000,
    "orderId": "order-payment-001",
    "idempotencyKey": "topup-key-001"
  }'

echo ""
echo ""

# ============================================================================
# TRANSACTION - BONUS (System Issues Credits)
# ============================================================================

echo "=== Issue 100 Loyalty Points to Alice ==="
curl -X POST http://localhost:3000/api/transactions/bonus \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "assetCode": "LOYALTY_POINTS",
    "amount": 100,
    "reason": "Daily login bonus",
    "idempotencyKey": "bonus-daily-001"
  }'

echo ""
echo ""

# ============================================================================
# TRANSACTION - SPEND (User Purchases Item)
# ============================================================================

echo "=== Spend 500 Gold for Legendary Sword ==="
curl -X POST http://localhost:3000/api/transactions/spend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "assetCode": "GOLD",
    "amount": 500,
    "itemName": "Legendary Sword",
    "idempotencyKey": "purchase-sword-001"
  }'

echo ""
echo ""

# ============================================================================
# TRANSACTION - ERROR CASES
# ============================================================================

echo "=== Try to Spend More Than Balance (should fail) ==="
curl -X POST http://localhost:3000/api/transactions/spend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "assetCode": "GOLD",
    "amount": 999999,
    "itemName": "Impossible Item",
    "idempotencyKey": "fail-purchase-001"
  }'

echo ""
echo ""

# ============================================================================
# IDEMPOTENCY TEST
# ============================================================================

echo "=== Idempotency Test: Issue Bonus First Time ==="
curl -X POST http://localhost:3000/api/transactions/bonus \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 2,
    "assetCode": "GOLD",
    "amount": 500,
    "reason": "Referral bonus",
    "idempotencyKey": "referral-bonus-001"
  }'

echo ""
echo ""

echo "=== Idempotency Test: Retry with Same Key (should be duplicate) ==="
curl -X POST http://localhost:3000/api/transactions/bonus \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 2,
    "assetCode": "GOLD",
    "amount": 500,
    "reason": "Referral bonus",
    "idempotencyKey": "referral-bonus-001"
  }'

echo ""
echo ""

# ============================================================================
# TRANSACTION HISTORY
# ============================================================================

echo "=== Get Alice's Gold Transaction History (limit 10) ==="
curl -X GET "http://localhost:3000/api/transactions/history/1/GOLD?limit=10&offset=0"

echo ""
echo ""

echo "=== Get Bob's Gold Transaction History (limit 5) ==="
curl -X GET "http://localhost:3000/api/transactions/history/2/GOLD?limit=5&offset=0"

echo ""
echo ""

# ============================================================================
# AUDIT & VALIDATION
# ============================================================================

echo "=== Validate Wallet #1 State ==="
curl -X GET http://localhost:3000/api/audit/validate/1

echo ""
echo ""

echo "=== Validate Wallet #2 State ==="
curl -X GET http://localhost:3000/api/audit/validate/2

echo ""
echo ""

# ============================================================================
# VERIFY UPDATES
# ============================================================================

echo "=== Verify Alice's Updated Gold Balance ==="
curl -X GET http://localhost:3000/api/wallets/1/GOLD

echo ""
echo ""

echo "=== Verify Bob's Updated Loyalty Points ==="
curl -X GET http://localhost:3000/api/wallets/2/LOYALTY_POINTS

echo ""
