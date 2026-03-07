#!/usr/bin/env node
/** Run debug-reports table migration using DATABASE_URL (from .env or env). */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync(path.join(__dirname, 'add-debug-reports-table.sql'), 'utf8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
});

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env or set env.');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('[DB-DEBUG] fantasy_fc_debug_reports migration applied.');
  } catch (e) {
    console.error('[DB-ERROR] Migration failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
