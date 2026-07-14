// ============================================
// USER MANAGEMENT ROUTES — CRUD (admin only)
// ============================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Department from '../models/Department.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

function formatUser(u) {
  return { id: u._id, studentId: u.student_id, name: u.name, email: u.email, departmentId: u.department_id, role: u.role, status: u.status, phoneNumber: u.phone_number, year: u.year };
}

// GET /api/users
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { search } = req.query;
    let filter = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      filter = { $or: [{ name: regex }, { student_id: regex }, { email: regex }] };
    }
    const rows = await User.find(filter).sort({ created_at: -1 }).lean();
    res.json(rows.map(formatUser));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// POST /api/users
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, studentId, email, role, departmentId, password, phoneNumber, year } = req.body;
    if (!name || !studentId || !email) return res.status(400).json({ error: 'Name, studentId, and email are required.' });
    const existing = await User.findOne({ student_id: studentId }).lean();
    if (existing) return res.status(409).json({ error: 'Student ID already registered.' });
    const id = `user-${Date.now()}`;
    const hash = bcrypt.hashSync(password || 'changeme123', 10);
    await User.create({ _id: id, student_id: studentId, name, email, password_hash: hash, department_id: departmentId || null, role: role || 'voter', phone_number: phoneNumber || null, year: year || null });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'User Registered', performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ studentId, role: role || 'voter' }) });
    const created = await User.findById(id).lean();
    res.status(201).json(formatUser(created));
  } catch (err) { console.error('Create user error:', err); res.status(500).json({ error: 'Internal server error.' }); }
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { name, email, role, status, departmentId, phoneNumber, year } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (status !== undefined) updates.status = status;
    if (departmentId !== undefined) updates.department_id = departmentId;
    if (phoneNumber !== undefined) updates.phone_number = phoneNumber;
    if (year !== undefined) updates.year = year;
    if (Object.keys(updates).length) await User.updateOne({ _id: req.params.id }, { $set: updates });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'User Updated', performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ userId: req.params.id }) });
    const updated = await User.findById(req.params.id).lean();
    res.json(formatUser(updated));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// DELETE /api/users/clear/voters — clear voter registry (optionally by year)
router.delete('/clear/voters', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { year } = req.query;
    const filter = { role: 'voter' };
    if (year) {
      filter.year = year;
    }
    const result = await User.deleteMany(filter);
    const logAction = year ? `Voter Registry Cleared for ${year}` : 'Voter Registry Cleared';
    await AuditLog.create({ _id: `log-${Date.now()}`, action: logAction, performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ deletedCount: result.deletedCount, yearFilter: year || null }) });
    res.json({ message: `Successfully cleared ${result.deletedCount} voters${year ? ` in ${year}` : ''}.`, count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear voter registry.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user._id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account.' });
    await User.deleteOne({ _id: req.params.id });
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'User Deleted', performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ userId: req.params.id, name: user.name }) });
    res.json({ message: 'User deleted.', id: req.params.id });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// POST /api/users/import — bulk import
router.post('/import', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users) || !users.length) return res.status(400).json({ error: 'An array of users is required.' });
    const allDepts = await Department.find().lean();
    let importedCount = 0;
    for (const u of users) {
      if (!u.name || !u.studentId || !u.email) continue;
      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const role = u.role || 'voter';
      const hash = role === 'voter' ? null : bcrypt.hashSync(u.password || u.studentId || 'admin123', 10);
      let departmentId = null;
      if (u.department) {
        const deptStr = u.department.trim().toLowerCase();
        const match = allDepts.find(d => 
          d._id.toLowerCase() === deptStr ||
          d.code.toLowerCase() === deptStr || 
          d.name.toLowerCase() === deptStr || 
          d.name.toLowerCase().includes(deptStr) || 
          deptStr.includes(d.code.toLowerCase()) || 
          deptStr.includes(d.name.toLowerCase())
        );
        if (match) departmentId = match._id;
      } else if (u.departmentId) { departmentId = u.departmentId; }
      let phoneNumber = u.phone || u.phoneNumber || u.phone_number || null;
      if (phoneNumber) {
        phoneNumber = String(phoneNumber).trim();
        if (/^\d{9,10}$/.test(phoneNumber) && !phoneNumber.startsWith('0')) phoneNumber = '0' + phoneNumber;
      }
      await User.findOneAndUpdate(
        { student_id: u.studentId },
        { $set: { name: u.name, email: u.email, department_id: departmentId || undefined, phone_number: phoneNumber || undefined, year: u.year || undefined }, $setOnInsert: { _id: id, student_id: u.studentId, password_hash: hash, role: role, status: 'active' } },
        { upsert: true }
      );
      importedCount++;
    }
    await AuditLog.create({ _id: `log-${Date.now()}`, action: 'Bulk Users Imported', performed_by: req.user.name, role: 'Admin', timestamp: new Date().toISOString(), metadata: JSON.stringify({ count: importedCount }) });
    res.json({ message: `Successfully imported ${importedCount} users.`, count: importedCount });
  } catch (err) { console.error('Import error:', err); res.status(500).json({ error: 'Failed to import users.' }); }
});

export default router;
