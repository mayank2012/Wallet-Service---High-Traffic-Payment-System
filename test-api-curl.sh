#!/usr/bin/env bash

# Wallet Service API Testing Guide
# Example curl commands for all endpoints
# 
# Make sure the server is running first:
# node run-server.js

API_BASE="http://localhost:3000"

echo "🎮 Wallet Service API Testing"
echo "=============================="
echo ""

# 1. Health Check
echo "1️⃣  Testing Health Endpoint..."
curl -X GET "$API_BASE/health" -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 2. Get Alice's wallets
echo "2️⃣  Get All Wallets for Alice (user_id: 3)..."
curl -X GET "$API_BASE/api/wallets/3" -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 3. Get Alice's GOLD balance
echo "3️⃣  Get Alice's GOLD Balance..."
curl -X GET "$API_BASE/api/wallets/3/GOLD" -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 4. Top-up Alice's GOLD
echo "4️⃣  Top-up Alice's GOLD (+1000)..."
TOPUP_KEY="topup-$(date +%s%N)"
curl -X POST "$API_BASE/api/transactions/topup" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": 3,
    \"assetCode\": \"GOLD\",
    \"amount\": 1000,
    \"orderId\": \"order-12345\",
    \"idempotencyKey\": \"$TOPUP_KEY\"
  }" | jq '.'
echo ""
echo ""

# 5. Issue bonus
echo "5️⃣  Issue Bonus to Alice (100 DIAMONDS)..."
BONUS_KEY="bonus-$(date +%s%N)"
curl -X POST "$API_BASE/api/transactions/bonus" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": 3,
    \"assetCode\": \"DIAMONDS\",
    \"amount\": 100,
    \"reason\": \"Loyalty Reward\",
    \"idempotencyKey\": \"$BONUS_KEY\"
  }" | jq '.'
echo ""
echo ""

# 6. Spend credits
echo "6️⃣  Spend Loyalty Points (300 from Alice)..."
SPEND_KEY="spend-$(date +%s%N)"
curl -X POST "$API_BASE/api/transactions/spend" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": 3,
    \"assetCode\": \"LOYALTY_POINTS\",
    \"amount\": 300,
    \"itemName\": \"Premium Item\",
    \"idempotencyKey\": \"$SPEND_KEY\"
  }" | jq '.'
echo ""
echo ""

# 7. Get transaction history
echo "7️⃣  Get Alice's GOLD Transaction History..."
curl -X GET "$API_BASE/api/transactions/history/3/GOLD?limit=10&offset=0" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 8. Validate wallet
echo "8️⃣  Validate Alice's GOLD Wallet (ID: 7)..."
curl -X GET "$API_BASE/api/audit/validate/7" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 9. Test idempotency (same request twice)
echo "9️⃣  Testing Idempotency (duplicate request)..."
IDEMPOTENT_KEY="test-idempotent-$(date +%s)"
echo "First request..."
curl -X POST "$API_BASE/api/transactions/topup" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": 4,
    \"assetCode\": \"GOLD\",
    \"amount\": 500,
    \"orderId\": \"order-dup-test\",
    \"idempotencyKey\": \"$IDEMPOTENT_KEY\"
  }" | jq '.data.isDuplicate'

echo "Second request (same key - should show isDuplicate: true)..."
curl -X POST "$API_BASE/api/transactions/topup" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": 4,
    \"assetCode\": \"GOLD\",
    \"amount\": 500,
    \"orderId\": \"order-dup-test\",
    \"idempotencyKey\": \"$IDEMPOTENT_KEY\"
  }" | jq '.data.isDuplicate'
echo ""
echo ""

echo "✅ All tests completed!"
