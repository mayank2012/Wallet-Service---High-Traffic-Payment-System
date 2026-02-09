# Wallet Service API Testing Guide (PowerShell)
# Complete example of all endpoints
# 
# Usage: .\test-api.ps1
# Make sure the server is running first: node run-server.js

$API_BASE = "http://localhost:3000"

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body,
        [string]$Description
    )
    
    Write-Host $Description -ForegroundColor Cyan
    Write-Host "---" -ForegroundColor Gray
    
    $url = "$API_BASE$Endpoint"
    
    try {
        if ($Body) {
            $response = Invoke-WebRequest -Uri $url -Method $Method -Body ($Body | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
        } else {
            $response = Invoke-WebRequest -Uri $url -Method $Method -ContentType "application/json" -UseBasicParsing
        }
        
        $content = $response.Content | ConvertFrom-Json
        Write-Host ($content | ConvertTo-Json -Depth 3) -ForegroundColor Green
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host ""
}

Write-Host "🎮 Wallet Service API Testing" -ForegroundColor Magenta
Write-Host "==============================" -ForegroundColor Magenta
Write-Host ""

# 1. Health Check
Test-Endpoint -Method GET -Endpoint "/health" -Description "1️⃣  Testing Health Endpoint..."

# 2. Get Alice's wallets
Test-Endpoint -Method GET -Endpoint "/api/wallets/3" -Description "2️⃣  Get All Wallets for Alice (user_id: 3)..."

# 3. Get Alice's GOLD balance
Test-Endpoint -Method GET -Endpoint "/api/wallets/3/GOLD" -Description "3️⃣  Get Alice's GOLD Balance..."

# 4. Top-up Alice's GOLD
$topupKey = "topup-$(Get-Random -Minimum 100000 -Maximum 999999)"
$topupBody = @{
    userId = 3
    assetCode = "GOLD"
    amount = 1000
    orderId = "order-ps-$(Get-Random)"
    idempotencyKey = $topupKey
}
Test-Endpoint -Method POST -Endpoint "/api/transactions/topup" -Body $topupBody -Description "4️⃣  Top-up Alice's GOLD (+1000)..."

# 5. Issue bonus
$bonusKey = "bonus-$(Get-Random -Minimum 100000 -Maximum 999999)"
$bonusBody = @{
    userId = 3
    assetCode = "DIAMONDS"
    amount = 100
    reason = "Loyalty Reward"
    idempotencyKey = $bonusKey
}
Test-Endpoint -Method POST -Endpoint "/api/transactions/bonus" -Body $bonusBody -Description "5️⃣  Issue Bonus to Alice (100 DIAMONDS)..."

# 6. Spend credits
$spendKey = "spend-$(Get-Random -Minimum 100000 -Maximum 999999)"
$spendBody = @{
    userId = 3
    assetCode = "LOYALTY_POINTS"
    amount = 300
    itemName = "Premium Item"
    idempotencyKey = $spendKey
}
Test-Endpoint -Method POST -Endpoint "/api/transactions/spend" -Body $spendBody -Description "6️⃣  Spend Loyalty Points (300 from Alice)..."

# 7. Get transaction history
Write-Host "7️⃣  Get Alice's GOLD Transaction History..." -ForegroundColor Cyan
Write-Host "---" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "$API_BASE/api/transactions/history/3/GOLD?limit=10&offset=0" -Method GET -ContentType "application/json" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    Write-Host ($content | ConvertTo-Json -Depth 3) -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Write-Host ""

# 8. Validate wallet
Write-Host "8️⃣  Validate Alice's GOLD Wallet (ID: 7)..." -ForegroundColor Cyan
Write-Host "---" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "$API_BASE/api/audit/validate/7" -Method GET -ContentType "application/json" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    Write-Host ($content | ConvertTo-Json -Depth 3) -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Write-Host ""

# 9. Test idempotency
Write-Host "9️⃣  Testing Idempotency (duplicate request)..." -ForegroundColor Cyan
Write-Host "---" -ForegroundColor Gray
$idempotentKey = "test-idempotent-$(Get-Random -Minimum 100000 -Maximum 999999)"
$idempotentBody = @{
    userId = 4
    assetCode = "GOLD"
    amount = 500
    orderId = "order-dup-test"
    idempotencyKey = $idempotentKey
}

Write-Host "First request..." -ForegroundColor Yellow
try {
    $response1 = Invoke-WebRequest -Uri "$API_BASE/api/transactions/topup" -Method POST -Body ($idempotentBody | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    $content1 = $response1.Content | ConvertFrom-Json
    Write-Host "isDuplicate: $($content1.data.isDuplicate)" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Second request (same key - should show isDuplicate: true)..." -ForegroundColor Yellow
try {
    $response2 = Invoke-WebRequest -Uri "$API_BASE/api/transactions/topup" -Method POST -Body ($idempotentBody | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    $content2 = $response2.Content | ConvertFrom-Json
    Write-Host "isDuplicate: $($content2.data.isDuplicate)" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ All tests completed!" -ForegroundColor Green
