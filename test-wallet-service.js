const { initDb } = require('./src/sqlite-db');
const walletService = require('./src/walletService-sqlite');

async function testWalletService() {
  try {
    console.log('Initializing database...');
    await initDb();
    console.log('✓ Database initialized\n');
    
    console.log('Testing Wallet Service directly...\n');
    
    // Test 1: Get Alice's wallets
    console.log('1️⃣  Getting all wallets for Alice (user_id: 3)...');
    const aliceWallets = await walletService.getAllWallets(3);
    console.table(aliceWallets);
    
    // Test 2: Get Alice's GOLD balance
    console.log('\n2️⃣  Getting Alice\'s GOLD balance...');
    const goldWallet = await walletService.getWalletBalance(3, 'GOLD');
    console.log('Alice GOLD Wallet:', goldWallet);
    
    // Test 3: Perform a topup
    console.log('\n3️⃣  Topping up Alice\'s GOLD by 500...');
    const topupResult = await walletService.topupWallet(3, 'GOLD', 500, `topup-${Date.now()}`, 'order-001');
    console.log('Topup Result:', topupResult);
    
    // Test 4: Check balance after topup
    console.log('\n4️⃣  Checking Alice\'s GOLD after topup...');
    const updatedGold = await walletService.getWalletBalance(3, 'GOLD');
    console.log('Updated Gold Balance:', updatedGold);
    
    // Test 5: Issue bonus
    console.log('\n5️⃣  Issuing 100 DIAMONDS bonus to Alice...');
    const bonusResult = await walletService.issueBonus(3, 'DIAMONDS', 100, 'Loyalty Reward', `bonus-${Date.now()}`);
    console.log('Bonus Result:', bonusResult);
    
    // Test 6: Check balance after bonus
    console.log('\n6️⃣  Checking Alice\'s DIAMONDS after bonus...');
    const updatedDiamonds = await walletService.getWalletBalance(3, 'DIAMONDS');
    console.log('Updated Diamonds Balance:', updatedDiamonds);
    
    // Test 7: Spend credits
    console.log('\n7️⃣  Spending 300 LOYALTY_POINTS from Alice...');
    const spendResult = await walletService.spendCredits(3, 'LOYALTY_POINTS', 300, 'Premium Item Purchase', `spend-${Date.now()}`);
    console.log('Spend Result:', spendResult);
    
    // Test 8: Get transaction history
    console.log('\n8️⃣  Getting Alice\'s recent transactions...');
    const history = await walletService.getTransactionHistory(3, 'GOLD', 5, 0);
    console.table(history);
    
    console.log('\n✅ All wallet service tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testWalletService();
