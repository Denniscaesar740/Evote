// ============================================
// ANNOUNCEMENT ROUTES
// ============================================
import { Router } from 'express';
import Announcement from '../models/Announcement.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/announcements
router.get('/', authenticate, async (req, res) => {
  try {
    const rows = await Announcement.find().sort({ timestamp: -1 }).lean();
    res.json(rows.map(r => ({ id: r._id, title: r.title, content: r.content, category: r.category, target: r.target, timestamp: r.timestamp })));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// POST /api/announcements (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, content, category, target } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });
    const id = `ann-${Date.now()}`;
    const timestamp = new Date().toISOString();
    await Announcement.create({ _id: id, title, content, category: category || 'info', target: target || 'all', timestamp });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Announcement Posted', performed_by: req.user.name, role: 'Admin', timestamp, metadata: JSON.stringify({ title }) });
    const created = await Announcement.findById(id).lean();
    res.status(201).json({ id: created._id, title: created.title, content: created.content, category: created.category, target: created.target, timestamp: created.timestamp });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
