#!/bin/bash

# Fantasy FC Tracker - Send Update to Discord
# Runs the tracker and sends results to FC group

set -e

cd ~/code/fc_planner/fantasy-fc-tracker

# Set PATH for cron (openclaw is in /opt/homebrew/bin)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# Run update
./update.sh >> data/cron.log 2>&1

# Send to Discord FC channel via OpenClaw API
/opt/homebrew/bin/openclaw message send \
  --channel discord \
  --target channel:1475021681012510751 \
  --message "$(cat data/latest-update.txt)" \
  >> data/cron.log 2>&1

echo "[$(date)] Update sent successfully" >> data/cron.log
