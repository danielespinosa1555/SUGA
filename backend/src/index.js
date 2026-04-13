require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

require('./config/passport');
const { syncSchema } = require('./config/dbSync');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status:'ok', app:'SUGA API', version:'1.0.0', timestamp: new Date().toISOString() });
});

// ── START: sync DB first, THEN load routes ──────────────────────────────────
async function start() {
  try {
    console.log('\n[SUGA] Syncing database schema...');
    await syncSchema();                          // ← tables exist before any request
    console.log('[SUGA] Schema ready.\n');

    // Load routes AFTER schema is confirmed
    const routes = require('./routes');
    app.use('/api', routes);
    app.use(notFound);
    app.use(errorHandler);

    app.listen(PORT, () => {
      console.log(`🚀 SUGA API running on http://localhost:${PORT}`);
      console.log(`📋 Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ configured' : '⚠️  not configured'}`);
      console.log(`📧 Email SMTP  : ${process.env.SMTP_USER ? `✅ ${process.env.SMTP_USER}` : '⚠️  not configured'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start SUGA:', err.message);
    process.exit(1);
  }
}

start();
module.exports = app;

// Pega esto al inicio de tu archivo
import cors from 'cors'

// Después de: const app = express()
app.use(cors({
  origin: 'https://tu-proyecto.vercel.app' // pon aquí tu URL real de Vercel
}))

app.get("/", (req, res) => {
  res.json({ mensaje: "Backend Suga funcionando" })
})
