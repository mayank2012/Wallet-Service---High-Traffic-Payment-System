// SQLite3 database connection and initialization
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../wallet.db');

let db = null;

// Initialize database connection
function initDb() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Database connection timeout'));
    }, 5000);

    db = new sqlite3.Database(DB_PATH, (err) => {
      clearTimeout(timeout);
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database at:', DB_PATH);
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      }
    });
  });
}

// Promisify database methods for async/await
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
    
    const timeout = setTimeout(() => {
      reject(new Error('Database operation timeout'));
    }, 5000);
    
    db.run(sql, params, function(err) {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

module.exports = {
  getDb: () => db,
  initDb,
  dbAll,
  dbGet,
  dbRun,
  close: () => {
    return new Promise((resolve, reject) => {
      if (!db) return resolve();
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};
