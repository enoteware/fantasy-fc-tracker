#!/usr/bin/env node
/**
 * List open debug reports grouped by entity and field for agent review.
 * Usage: node scripts/list-debug-reports.js [--status=open] [--entity-type=player]
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
});

const args = process.argv.slice(2);
let status = 'open';
let entityType = '';
args.forEach((arg) => {
  if (arg.startsWith('--status=')) status = arg.slice(9);
  if (arg.startsWith('--entity-type=')) entityType = arg.slice(14);
});

async function listReports() {
  const client = await pool.connect();
  try {
    let query = `
      SELECT id, entity_type, entity_key, field_path, rendered_value, schema_group, comment, status, created_at
      FROM fantasy_fc_debug_reports
      WHERE status = $1
    `;
    const params = [status];
    if (entityType) {
      params.push(entityType);
      query += ' AND entity_type = $2';
    }
    query += ' ORDER BY entity_type, entity_key, created_at DESC';

    const result = await client.query(query, params);
    console.log('[DB-DEBUG] list-debug-reports query status=%s count=%s', status, result.rows.length);

    const byEntity = {};
    result.rows.forEach((row) => {
      const key = row.entity_type + ':' + row.entity_key;
      if (!byEntity[key]) byEntity[key] = [];
      byEntity[key].push(row);
    });

    console.log('\n--- Open debug reports (for agent fix) ---\n');
    Object.keys(byEntity).sort().forEach((key) => {
      const rows = byEntity[key];
      console.log('Entity: %s', key);
      rows.forEach((r) => {
        console.log('  [%s] %s = %s', r.schema_group, r.field_path, r.rendered_value);
        if (r.comment) console.log('    Comment: %s', r.comment);
        console.log('    Report id: %s', r.id);
      });
      console.log('');
    });

    if (result.rows.length === 0) {
      console.log('No reports with status=%s%s.', status, entityType ? ' entity_type=' + entityType : '');
    }
  } catch (e) {
    console.error('[DB-ERROR] list-debug-reports', e.message);
    if (e.message && e.message.includes('does not exist')) {
      console.error('Run the migration first: psql $DATABASE_URL -f scripts/add-debug-reports-table.sql');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

listReports();
