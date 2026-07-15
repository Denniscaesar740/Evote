// ============================================
// SERVER ENTRY — UniVote ACSES UMaT Backend API
// ============================================
import 'dotenv/config';
if (process.env.NODE_ENV !== 'development') {
  process.env.NODE_ENV = 'production';
}
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';

const swaggerDocument = JSON.parse(readFileSync(new URL('./swagger.json', import.meta.url)));

// Import database connection
import { connectDB } from './db.js';

// Import routes
import authRoutes from './routes/auth.js';
import electionRoutes from './routes/elections.js';
import candidateRoutes from './routes/candidates.js';
import voteRoutes from './routes/votes.js';
import userRoutes from './routes/users.js';
import departmentRoutes from './routes/departments.js';
import auditLogRoutes from './routes/auditLogs.js';
import announcementRoutes from './routes/announcements.js';
import notificationRoutes from './routes/notifications.js';
import healthCheckRoutes from './routes/healthChecks.js';
import { initScheduler } from './utils/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── Security Headers Configuration ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
}));

const PORT = process.env.PORT || 5000;

// ─── CORS Configuration ───
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ];

app.use(cors({
  origin: (origin, callback) => {
    // Permit requests without Origin headers (same-origin, curl, server-to-server check)
    if (!origin) return callback(null, true);

    // Permit matching origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      if (isLocalhost) return callback(null, true);
    }

    // Disallow Cross-Origin request by not adding headers, but do not throw unhandled system exceptions
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Content-Disposition', 'attachment');
  }
}));



// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/health-checks', healthCheckRoutes);

// ─── API Documentation (Swagger UI) ───
app.use('/api/docs', (req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';");
  next();
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const serveStatusPage = (req, res) => {
  res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; font-src * data:;");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UniVote API Engine — Active</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --green-50: #f0fdf4;
      --green-100: #dcfce7;
      --green-700: #15803d;
      --green-900: #14532d;
      --green-950: #052e16;
      --gold-500: #f59e0b;
      --gold-600: #d97706;
      --navy-900: #0f172a;
      --navy-950: #020617;
      --gray-400: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: linear-gradient(135deg, var(--navy-950) 0%, var(--green-950) 100%);
      color: #f8fafc;
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow-x: hidden;
    }
    .container {
      max-width: 580px;
      width: 100%;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
    }
    .container::before {
      content: '';
      position: absolute;
      top: -150px;
      right: -150px;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 60%);
      width: 400px;
      height: 400px;
      pointer-events: none;
    }
    .logo-container {
      display: inline-flex;
      background: linear-gradient(135deg, var(--green-700), var(--green-900));
      color: #fff;
      border: 2px solid var(--gold-500);
      width: 80px;
      height: 80px;
      border-radius: 20px;
      align-items: center;
      justify-content: center;
      font-size: 38px;
      font-weight: 800;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px rgba(245, 158, 11, 0.15);
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(to right, #ffffff, #fef08a, var(--gold-500));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    p.subtitle {
      font-size: 14px;
      color: var(--gray-400);
      margin-bottom: 28px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 600;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 8px 18px;
      border-radius: 99px;
      color: #4ade80;
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 32px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background-color: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 12px #22c55e;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 16px #4ade80; }
      100% { transform: scale(0.9); opacity: 0.6; }
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 32px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease-in-out;
      font-size: 14px;
    }
    .btn-primary {
      background: var(--green-700);
      color: #fff;
      border: 1.5px solid var(--green-700);
      box-shadow: 0 4px 15px rgba(21, 128, 61, 0.3);
    }
    .btn-primary:hover {
      background: #166534;
      border-color: #166534;
      transform: translateY(-1.5px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.03);
      color: #f1f5f9;
      border: 1.5px solid rgba(255, 255, 255, 0.08);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-1.5px);
    }
    .telemetry {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 14px;
      padding: 16px;
      text-align: left;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #cbd5e1;
    }
    .telemetry-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .telemetry-row:last-child {
      margin-bottom: 0;
    }
    .telemetry-label {
      color: #64748b;
    }
    .footer {
      margin-top: 32px;
      font-size: 11px;
      color: #475569;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">🗳️</div>
    <h1>UniVote API Gateway</h1>
    <p class="subtitle">ACSES UMaT E-Voting Engine</p>
    
    <div class="status-badge">
      <div class="status-dot"></div>
      Server Online & Active
    </div>

    <div class="actions">
      <a href="/api/docs/" class="btn btn-primary">
        <span>📖 Explore API Documentation</span>
      </a>
      <a href="/api/health" class="btn btn-secondary" target="_blank">
        <span>🩺 Check Core Health Status</span>
      </a>
    </div>

    <div class="telemetry">
      <div class="telemetry-row">
        <span class="telemetry-label">Engine Version:</span>
        <span>1.0.0 (Production)</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">MongoDB Driver:</span>
        <span>Atlas Connection Active</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Security:</span>
        <span>HSTS, Rate Limit & JWT Enabled</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Host Ping:</span>
        <span>${new Date().toISOString()}</span>
      </div>
    </div>

    <div class="footer">
      &copy; 2026 UNIVOTE PLATFORM. ALL RIGHTS RESERVED.
    </div>
  </div>
</body>
</html>`);
};

app.get('/', serveStatusPage);
app.get('/api', serveStatusPage);

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.json({ status: 'ok' });
  }
  res.json({
    status: 'ok',
    service: 'UniVote API',
    version: '1.0.0',
    database: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack || err.message);
  res.status(500).json({
    error: 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
});

// ─── 404 ───
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Connect to MongoDB and Start ───
async function start() {
  await connectDB();
  initScheduler();
  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║  🗳️  UniVote API Server                  ║`);
    console.log(`║  ACSES UMaT E-Voting System              ║`);
    console.log(`╠══════════════════════════════════════════╣`);
    console.log(`║  Port:     ${PORT}                            ║`);
    console.log(`║  DB:       MongoDB Atlas                  ║`);
    console.log(`║  API:      http://localhost:${PORT}/api        ║`);
    console.log(`║  Health:   http://localhost:${PORT}/api/health ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
  });
}

start().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

export default app;
