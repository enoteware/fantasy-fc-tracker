#!/usr/bin/env node
/**
 * Standalone debug-reports API for the Fantasy FC tracker.
 * POST /debug-reports — batch create reports
 * GET /debug-reports?status=open&entity_type=player — list reports
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const os = require('os');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
});

/** Debug API always runs on this port so the tracker can rely on it. */
const PORT = 3999;

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (ch) => { buf += ch; });
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function validateReport(r) {
  return r && typeof r.field_path === 'string' && r.field_path.length > 0 &&
    typeof r.schema_group === 'string' && r.schema_group.length > 0 &&
    (r.rendered_value === undefined || typeof r.rendered_value === 'string') &&
    (r.comment === undefined || typeof r.comment === 'string');
}

async function handlePost(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    console.error('[DB-ERROR] POST /debug-reports parse body', e.message);
    send(res, 400, { error: 'Invalid JSON' });
    return;
  }
  const entityType = body.entity_type && String(body.entity_type).trim();
  const entityKey = body.entity_key != null ? String(body.entity_key) : '';
  const reports = Array.isArray(body.reports) ? body.reports : [];
  const pageContext = body.page_context;

  if (!entityType || !entityKey) {
    send(res, 400, { error: 'entity_type and entity_key required' });
    return;
  }
  const valid = reports.filter(validateReport);
  if (valid.length === 0) {
    send(res, 400, { error: 'At least one valid report required (field_path, schema_group)' });
    return;
  }

  const client = await pool.connect();
  try {
    const inserted = [];
    for (const r of valid) {
      const result = await client.query(
        `INSERT INTO fantasy_fc_debug_reports
         (entity_type, entity_key, field_path, rendered_value, schema_group, comment, status, page_context, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())
         RETURNING id, entity_type, entity_key, field_path, status, created_at`,
        [
          entityType,
          entityKey,
          r.field_path,
          r.rendered_value != null ? r.rendered_value : null,
          r.schema_group,
          r.comment != null ? r.comment : null,
          pageContext != null ? JSON.stringify(pageContext) : null
        ]
      );
      inserted.push(result.rows[0]);
      console.log('[DB-DEBUG] Inserted debug report id=%s entity_key=%s field_path=%s', result.rows[0].id, entityKey, r.field_path);
    }
    send(res, 200, { ok: true, inserted: inserted.length, ids: inserted.map((r) => r.id) });
  } catch (e) {
    console.error('[DB-ERROR] POST /debug-reports insert', e.message);
    send(res, 500, { error: 'Insert failed', detail: e.message });
  } finally {
    client.release();
  }
}

async function handleGet(req, res) {
  const url = new URL(req.url || '', 'http://' + (req.headers.host || 'localhost'));
  const status = url.searchParams.get('status') || 'open';
  const entityType = url.searchParams.get('entity_type') || '';

  const client = await pool.connect();
  try {
    let query = 'SELECT id, entity_type, entity_key, field_path, rendered_value, schema_group, comment, status, page_context, created_at, updated_at FROM fantasy_fc_debug_reports WHERE status = $1';
    const params = [status];
    if (entityType) {
      params.push(entityType);
      query += ' AND entity_type = $2';
    }
    query += ' ORDER BY created_at DESC';
    const result = await client.query(query, params);
    console.log('[DB-DEBUG] GET /debug-reports status=%s count=%s', status, result.rows.length);
    send(res, 200, { reports: result.rows });
  } catch (e) {
    console.error('[DB-ERROR] GET /debug-reports', e.message);
    send(res, 500, { error: 'Query failed', detail: e.message });
  } finally {
    client.release();
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }
  const path = (req.url || '').split('?')[0];
  if (path === '/debug-reports' && req.method === 'POST') {
    await handlePost(req, res);
    return;
  }
  if (path === '/debug-reports' && req.method === 'GET') {
    await handleGet(req, res);
    return;
  }
  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  console.log('[DEBUG-API] Listening on port %s', PORT);
  console.log('[DEBUG-API] Local:    http://127.0.0.1:%s', PORT);
  if (ips.length) console.log('[DEBUG-API] Network:  http://%s:%s', ips[0], PORT);
});
