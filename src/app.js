const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Allowed browser origins: local dev + any listed in CLIENT_URL (comma-separated,
// e.g. the deployed Purchase Manager frontend URL). Native / curl (no Origin) allowed.
const defaultOrigins = ['http://localhost:5178', 'http://localhost:5173', 'http://localhost:4173'];
const envOrigins = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean);
const allowed = new Set([...defaultOrigins, ...envOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowed.has(origin)) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Server error' });
});

module.exports = app;
