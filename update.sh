#!/bin/bash
set -e
cd ~/code/fc_planner/fantasy-fc-tracker
echo "📥 Fetching..."
node scripts/scrape-sofascore.js
echo "📊 Generating..."
node scripts/generate-discord.js > data/latest-update.txt
node scripts/generate-html-final.js
echo "✅ Done!"
