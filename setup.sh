#!/bin/bash

# Fantasy FC Tracker Setup Script

set -e

echo "🚀 Fantasy FC Tracker Setup"
echo "==========================="
echo ""

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "❌ PostgreSQL not found. Install with: brew install postgresql@16"
  exit 1
fi

echo "✅ PostgreSQL found"

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw fc_planner; then
  echo "✅ Database 'fc_planner' exists"
else
  echo "📦 Creating database 'fc_planner'..."
  createdb fc_planner
  echo "✅ Database created"
fi

# Run schema
echo "📋 Running schema..."
psql fc_planner < schema.sql > /dev/null 2>&1
echo "✅ Schema applied"

# Copy .env if not exists
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  echo "⚠️  Edit .env and add your PostgreSQL password"
else
  echo "✅ .env exists"
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install --silent
echo "✅ Dependencies installed"

# Seed players
echo "🌱 Seeding Fantasy FC players..."
node scripts/seed-players.js
echo ""

# Test scraper
echo "🧪 Testing SofaScore API..."
node -e "
const fetch = require('node-fetch');
require('dotenv').config();
fetch('https://sofascore.p.rapidapi.com/tournaments/get-matches?tournamentId=17&seasonId=61627&pageIndex=0', {
  headers: {
    'x-rapidapi-host': 'sofascore.p.rapidapi.com',
    'x-rapidapi-key': process.env.RAPIDAPI_KEY
  }
})
.then(r => r.ok ? console.log('✅ SofaScore API working') : console.log('❌ API failed'))
.catch(e => console.log('❌ API error:', e.message));
" 2>/dev/null || echo "⚠️  SofaScore API not tested (install node-fetch first)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run first scrape: ./update.sh"
echo "  2. Check output: cat data/latest-update.txt"
echo "  3. Set up cron: crontab -e"
echo "     Add: 0 23 * * * cd $(pwd) && ./update.sh"
