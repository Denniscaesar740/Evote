// ============================================
// SERVER ENTRY — UniVote ACSES UMaT Backend API
// ============================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import database connection
import { connectDB } from './db.js';

// Import routes
import authRoutes          from './routes/auth.js';
import electionRoutes      from './routes/elections.js';
import candidateRoutes     from './routes/candidates.js';
import voteRoutes          from './routes/votes.js';
import userRoutes          from './routes/users.js';
import departmentRoutes    from './routes/departments.js';
import auditLogRoutes      from './routes/auditLogs.js';
import announcementRoutes  from './routes/announcements.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
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
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow any localhost port or configured origins
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    if (isLocalhost || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));



// ─── API Routes ───
app.use('/api/auth',          authRoutes);
app.use('/api/elections',     electionRoutes);
app.use('/api/candidates',    candidateRoutes);
app.use('/api/votes',         voteRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/departments',   departmentRoutes);
app.use('/api/audit-logs',    auditLogRoutes);
app.use('/api/announcements', announcementRoutes);

// ─── Health Check ───
app.get('/api/health', (req, res) => {
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
