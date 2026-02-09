#!/bin/bash

# Wallet Service Setup Script
# This script sets up the entire wallet service environment

set -e  # Exit on error

echo "========================================="
echo "   Wallet Service Setup"
echo "========================================="
echo

# Check if PostgreSQL is running
echo "Checking PostgreSQL connection..."
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✗ PostgreSQL is not running on localhost:5432"
    echo "Please start PostgreSQL and try again."
    exit 1
fi
echo "✓ PostgreSQL is running"
echo

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✓ .env created (update with your database credentials if needed)"
else
    echo "✓ .env already exists"
fi
echo

# Install dependencies
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo

# Run database setup
echo "Setting up database schema..."
npm run db:setup
echo "✓ Database schema created"
echo

# Seed initial data
echo "Seeding initial data..."
npm run db:seed
echo "✓ Data seeded successfully"
echo

echo "========================================="
echo "   Setup Complete!"
echo "========================================="
echo
echo "Next steps:"
echo "1. Start the server:  npm start"
echo "2. Test the API:      node scripts/test-api.js"
echo
