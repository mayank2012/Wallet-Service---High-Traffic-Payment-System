const fs = require('fs');
const path = require('path');

// Simpler approach: just verify the database and wallet data directly
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = path.join(__dirname, 'wallet.db');

console.log('Testing SQLite database directly...');
console.log('DB Path:', DB_PATH);
console.log('DB exists:', fs.existsSync(DB_PATH));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Cannot open database:', err);
    process.exit(1);
  }
  
  console.log('✓ Database opened successfully');
  
  // Query to get user data
  db.all('SELECT * FROM users LIMIT 5', (err, rows) => {
    if (err) {
      console.error('❌ Error querying users:', err);
    } else {
      console.log('✓ Users in database:');
      console.table(rows);
    }
    
    // Query wallets
    db.all('SELECT w.id, u.username, a.code, w.balance FROM wallets w JOIN users u ON w.user_id = u.id JOIN asset_types a ON w.asset_id = a.id LIMIT 10', (err, rows) => {
      if (err) {
        console.error('❌ Error querying wallets:', err);
      } else {
        console.log('✓ Wallets in database:');
        console.table(rows);
      }
      
      // Query transactions
      db.all('SELECT * FROM transactions LIMIT 5', (err, rows) => {
        if (err) {
          console.error('❌ Error querying transactions:', err);
        } else {
          console.log('✓ Transactions in database:');
          console.table(rows);
        }
        
        db.close();
        console.log('\n✅ Database verification complete!');
        process.exit(0);
      });
    });
  });
});
