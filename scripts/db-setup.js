// Database schema initialization
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default postgres DB initially
});

async function setupDatabase() {
  const client = await pool.connect();

  try {
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'wallet_service';
    await client.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`Database '${dbName}' created or already exists`);

    await client.end();

    // Now connect to the actual wallet service database
    const servicePool = new Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: dbName,
    });

    const schemaClient = await servicePool.connect();

    try {
      // Read and execute schema file
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      // Execute each statement
      const statements = schemaSql.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await schemaClient.query(statement);
        }
      }

      console.log('Database schema created successfully');
    } finally {
      await schemaClient.end();
    }

    await servicePool.end();
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  }
}

setupDatabase();
