// ============================================
// AUDIT LOG ROUTES
// ============================================
import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import Anomaly from '../models/Anomaly.js';
import VoteRecord from '../models/VoteRecord.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

async function runAnomalyDetection() {
  // 1. Off-Hours Access check
  const votes = await VoteRecord.find().select('timestamp').lean();

  const voteLogs = await AuditLog.find({ action: 'Vote Cast' }).lean();
  const ipMap = {};
  for (const log of voteLogs) {
    try {
      const meta = log.metadata ? JSON.parse(log.metadata) : {};
      if (meta.blockHash && meta.clientIp) {
        ipMap[meta.blockHash] = meta.clientIp;
      }
    } catch (e) { }
  }

  for (const v of votes) {
    const date = new Date(v.timestamp);
    const hour = date.getHours();
    if (hour >= 23 || hour < 5) {
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toISOString().split('T')[0];
      const clientIp = ipMap[v._id] || 'unknown';
      const desc = `Vote request from IP ${clientIp} on ${dateStr} at ${timeStr}. Flagged for review.`;
      const id = `anomaly-offhours-${v._id}`;
      const existing = await Anomaly.findById(id).lean();
      if (!existing) await Anomaly.create({ _id: id, type: 'Off-Hours Access', desc, cleared: 0 });
    }
  }

  // 2. Rapid Consecutive Writes check
  const sortedVotes = await VoteRecord.find().sort({ timestamp: 1 }).select('timestamp').lean();
  for (let i = 1; i < sortedVotes.length; i++) {
    const prev = new Date(sortedVotes[i - 1].timestamp).getTime();
    const curr = new Date(sortedVotes[i].timestamp).getTime();
    const diff = curr - prev;
    if (diff > 0 && diff < 50) {
      const id = `anomaly-rapid-${sortedVotes[i]._id}`;
      const desc = `Three DB write transactions within ${diff}ms — within normal db latency threshold.`;
      const existing = await Anomaly.findById(id).lean();
      if (!existing) await Anomaly.create({ _id: id, type: 'Rapid Consecutive Writes', desc, cleared: 0 });
    }
  }
}

// GET /api/audit-logs
router.get('/', authenticate, authorize('admin', 'auditor'), async (req, res) => {
  try {
    const { limit = 200 } = req.query;
    const rows = await AuditLog.find().sort({ timestamp: -1 }).limit(Number(limit)).lean();
    res.json(rows.map(l => ({ id: l._id, action: l.action, performedBy: l.performed_by, role: l.role, timestamp: l.timestamp, metadata: l.metadata ? JSON.parse(l.metadata) : {} })));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /api/audit-logs/anomalies
router.get('/anomalies', authenticate, authorize('admin', 'auditor'), async (req, res) => {
  try { await runAnomalyDetection(); } catch (e) { console.error('Anomaly detection failed:', e); }
  try {
    const rows = await Anomaly.find().sort({ created_at: -1 }).lean();
    res.json(rows.map(r => ({ id: r._id, type: r.type, desc: r.desc, cleared: r.cleared === 1 })));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// POST /api/audit-logs/anomalies/:id/clear
router.post('/anomalies/:id/clear', authenticate, authorize('admin', 'auditor'), async (req, res) => {
  try {
    const existing = await Anomaly.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Anomaly not found.' });
    await Anomaly.updateOne({ _id: req.params.id }, { $set: { cleared: 1 } });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Anomaly Cleared', performed_by: req.user.name, role: req.user.role, timestamp: new Date().toISOString(), metadata: JSON.stringify({ anomalyId: req.params.id }) });
    res.json({ success: true, message: 'Anomaly cleared successfully.' });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
