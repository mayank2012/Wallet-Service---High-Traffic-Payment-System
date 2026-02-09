#!/bin/bash

# Windows Setup Script (PowerShell version)
# Run this script to set up the wallet service on Windows

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Node.js is installed" -ForegroundColor Green

# Check if PostgreSQL is running
Write-Host "Checking PostgreSQL connection..."
try {
    $testConnection = pg_isready -h localhost -p 5432 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
    } else {
        throw "Connection failed"
    }
} catch {
    Write-Host "✗ PostgreSQL is not running on localhost:5432" -ForegroundColor Red
    Write-Host "Please start PostgreSQL and try again." -ForegroundColor Yellow
    exit 1
}

# Create .env if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env created" -ForegroundColor Green
} else {
    Write-Host "✓ .env already exists" -ForegroundColor Green
}

# Install dependencies
Write-Host "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Run database setup
Write-Host "Setting up database schema..."
npm run db:setup
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to setup database" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Database schema created" -ForegroundColor Green

# Seed initial data
Write-Host "Seeding initial data..."
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to seed data" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Data seeded successfully" -ForegroundColor Green

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start the server:  npm start" -ForegroundColor White
Write-Host "2. Test the API:      node scripts/test-api.js" -ForegroundColor White
Write-Host ""
