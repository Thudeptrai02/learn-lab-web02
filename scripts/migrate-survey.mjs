import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, '../supabase/migrations/001_create_survey_tables.sql');
const sql = readFileSync(sqlPath, 'utf-8');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase/)[1];

// Try Management API with different auth headers
async function tryMgmtAPI() {
  const endpoints = [
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    `https://api.supabase.io/v1/projects/${projectRef}/database/query`,
    `https://${projectRef}.supabase.co/rest/v1/rpc/`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({ query: sql })
      });
      if (res.ok) {
        console.log(`✅ API success: ${url}`);
        return true;
      }
      const text = await res.text();
      console.log(`❌ ${res.status} ${url.slice(0, 60)}: ${text.slice(0, 80)}`);
    } catch (e) {
      console.log(`❌ error ${url.slice(0, 60)}: ${e.message.slice(0, 60)}`);
    }
  }
  return false;
}

// Try direct/SSL connection with different user formats
async function tryDirect() {
  const { default: pg } = await import('pg');
  const configs = [];
  
  // Try different host formats
  const hosts = [
    { host: projectRef + '.supabase.co', port: 5432 },
    { host: 'db.' + projectRef + '.supabase.co', port: 5432 },
  ];
  
  // Try different user formats
  const users = ['postgres', `postgres.${projectRef}`];
  
  for (const h of hosts) {
    for (const user of users) {
      configs.push({
        host: h.host,
        port: h.port,
        database: 'postgres',
        user,
        password: serviceKey,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 5000
      });
    }
  }

  for (const cfg of configs) {
    const pool = new pg.Pool(cfg);
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      console.log(`✅ Connected: ${cfg.user}@${cfg.host}:${cfg.port}`);
      await client.query(sql);
      console.log(`✅ Migration ran on ${cfg.host}`);
      await client.release();
      await pool.end();
      return true;
    } catch (e) {
      console.log(`❌ ${cfg.user}@${cfg.host}:${cfg.port} → ${e.message.slice(0, 60)}`);
      try { await pool.end(); } catch {}
    }
  }
  return false;
}

async function main() {
  console.log(`🔧 Project: ${projectRef}\n`);
  
  console.log('📡 Trying Management API...');
  if (await tryMgmtAPI()) return;
  
  console.log('\n📡 Trying direct PostgreSQL connections...');
  if (await tryDirect()) return;
  
  console.log('\n❌ All automated methods failed.');
  console.log('📋 SQL copied to clipboard.');
  console.log(`🔗 ${'https://supabase.com/dashboard/project/' + projectRef + '/sql/new'}`);
}

main();
