// ============================================
// DEPARTMENTS ROUTES
// ============================================
import { Router } from 'express';
import Department from '../models/Department.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/departments
router.get('/', authenticate, async (req, res) => {
  try {
    const depts = await Department.find().sort({ name: 1 }).lean();
    const result = await Promise.all(depts.map(async d => {
      const studentCount = await User.countDocuments({ department_id: d._id, role: 'voter' });
      return { id: d._id, name: d.name, code: d.code, faculty: d.faculty, studentCount };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// POST /api/departments
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id, name, code, faculty } = req.body;
    if (!id || !name || !code || !faculty) return res.status(400).json({ error: 'All fields (id, name, code, faculty) are required.' });
    const existing = await Department.findOne({ $or: [{ _id: id }, { code }] }).lean();
    if (existing) return res.status(409).json({ error: 'Department ID or code already exists.' });
    await Department.create({ _id: id, name, code, faculty });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Department Created', performed_by: req.user.name, role: req.user.role, timestamp: new Date().toISOString(), metadata: JSON.stringify({ id, name }) });
    res.json({ id, name, code, faculty, studentCount: 0 });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// PATCH /api/departments/:id
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code, faculty } = req.body;
    const dept = await Department.findById(req.params.id).lean();
    if (!dept) return res.status(404).json({ error: 'Department not found.' });
    const newName = name ?? dept.name;
    const newCode = code ?? dept.code;
    const newFaculty = faculty ?? dept.faculty;
    await Department.updateOne({ _id: req.params.id }, { $set: { name: newName, code: newCode, faculty: newFaculty } });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Department Updated', performed_by: req.user.name, role: req.user.role, timestamp: new Date().toISOString(), metadata: JSON.stringify({ id: req.params.id, name: newName }) });
    res.json({ id: req.params.id, name: newName, code: newCode, faculty: newFaculty });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
