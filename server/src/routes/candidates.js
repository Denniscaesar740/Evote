// ============================================
// CANDIDATE ROUTES — CRUD + image upload
// ============================================
import { Router } from 'express';
import Candidate from '../models/Candidate.js';
import Election from '../models/Election.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function saveBase64Image(base64Str) {
  if (!base64Str) return null;
  if (base64Str.startsWith('/uploads/')) return base64Str;
  
  const parts = base64Str.split(';base64,');
  if (parts.length !== 2) return null;
  
  const mimeParts = parts[0].split('/');
  if (mimeParts.length !== 2) return null;
  
  const mime = mimeParts[1]; // e.g. "png" or "jpeg" or "webp"
  const ext = mime === 'jpeg' ? 'jpg' : mime;
  const data = parts[1];
  const buffer = Buffer.from(data, 'base64');
  const filename = `cand-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `cand-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const router = Router();

function formatCandidate(c) {
  return {
    id: c._id, electionId: c.election_id, name: c.name, department: c.department,
    position: c.position, manifesto: c.manifesto, voteCount: c.vote_count,
    color: c.color, picture: c.picture,
  };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { electionId } = req.query;
    const filter = electionId ? { election_id: electionId } : {};
    const rows = await Candidate.find(filter).sort({ created_at: 1 }).lean();
    res.json(rows.map(formatCandidate));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const row = await Candidate.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ error: 'Candidate not found.' });
    res.json(formatCandidate(row));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/', authenticate, authorize('admin'), upload.single('picture'), async (req, res) => {
  try {
    const { electionId, name, position, manifesto, color, department } = req.body;
    if (!electionId || !name || !position) return res.status(400).json({ error: 'electionId, name, and position are required.' });
    const election = await Election.findById(electionId).lean();
    if (!election) return res.status(404).json({ error: 'Election not found.' });
    const id = `cand-${Date.now()}`;
    let picture = req.body.pictureData || req.body.picture || null;
    if (req.file) {
      picture = `/uploads/${req.file.filename}`;
    } else if (picture && picture.startsWith('data:image/')) {
      picture = saveBase64Image(picture);
    }
    await Candidate.create({ _id: id, election_id: electionId, name, department: department || '', position, manifesto: manifesto || '', vote_count: 0, color: color || '#2e7d32', picture });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Candidate Added', performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ electionId, candidate: name }) });
    const created = await Candidate.findById(id).lean();
    res.status(201).json(formatCandidate(created));
  } catch (err) { console.error('Create candidate error:', err); res.status(500).json({ error: 'Internal server error.' }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).lean();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
    await Candidate.deleteOne({ _id: req.params.id });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Candidate Deleted', performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ candidateId: req.params.id, name: candidate.name }) });
    res.json({ message: 'Candidate deleted.', id: req.params.id });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
