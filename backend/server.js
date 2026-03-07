const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Load .env file if it exists (won't exist on Vercel — env vars are set in dashboard)
const envPath = path.join(__dirname, 'config.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Fix: Node v25 SRV DNS resolution issue with MongoDB Atlas (skip on Vercel serverless)
if (!process.env.VERCEL) {
  try {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '8.8.4.4']);
  } catch (_e) { /* ignore */ }
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const progressRoutes = require('./routes/progress');
const chatRoutes = require('./routes/chat');
const settingsRoutes = require('./routes/settings');
const paymentRoutes = require('./routes/payments');

const app = express();

// Basic hardening — allow CDN resources used by the frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.stripe.com"],
      connectSrc: ["'self'", "https://neurolex.tech", "https://www.neurolex.tech", "https://api.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    }
  }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5000', 'https://neurolex.tech', 'https://www.neurolex.tech'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Connect to MongoDB — with connection caching for Vercel serverless.
// On serverless each invocation may reuse the same Node process, so we
// skip reconnecting if a connection is already open (readyState 1).
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dyslexia_detection';

let _mongoConnected = false;

async function connectDB() {
  if (_mongoConnected && mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    _mongoConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    _mongoConnected = false;
    throw err;
  }
}

// Connect immediately on startup (works for both local and Vercel)
connectDB().catch(err => {
  console.error('Initial MongoDB connect failed:', err.message);
  if (!process.env.VERCEL) process.exit(1);
});

// Middleware: ensure DB is connected before every request (handles cold starts)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection failed on request:', err.message);
    res.status(503).json({ status: 'error', message: 'Database unavailable. Please try again.' });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);
// Webhook must use raw body — register BEFORE the JSON body-parser middleware takes effect
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend (static files) from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  // If request is for an existing file in /public, serve it instead of always returning index.html
  const safePath = decodeURIComponent(req.path || '/');
  const candidate = path.join(__dirname, '..', 'public', safePath);

  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return res.sendFile(candidate);
    }
  } catch (_e) {
    // ignore and fall back to index.html
  }

  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

// Only start listening when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
