const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:    process.env.DB_HOST || 'localhost',
  port:    parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'suga_db',
  user:    process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis:     30000,
  connectionTimeoutMillis: 10000,  // was 2000 — too short, caused timeouts
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`⚠ Slow query (${ms}ms):`, text.slice(0, 80));
    }
    return res;
  } catch (err) {
    console.error('❌ Query error:', err.message);
    throw err;
  }
};

module.exports = { pool, query };
