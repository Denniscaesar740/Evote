// ============================================
// USER MANAGEMENT ROUTES — CRUD (admin only)
// ============================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Department from '../models/Department.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = Router();

function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : local[0] + '*'.repeat(local.length - 1);
  const maskedDomain = domain.length > 3
    ? domain[0] + '*'.repeat(domain.length - 2) + domain[domain.length - 1]
    : domain;
  return `${maskedLocal}@${maskedDomain}`;
}

function maskPhone(phone) {
  if (!phone) return 'N/A';
  const cleanPhone = phone.trim();
  if (cleanPhone.length < 4) return '***';
  return '*'.repeat(cleanPhone.length - 4) + cleanPhone.slice(-4);
}

function formatUser(u, maskPII = true) {
  return { id: u._id, studentId: u.student_id, name: u.name, email: maskPII ? maskEmail(u.email) : u.email, departmentId: u.department_id, role: u.role, status: u.status, phoneNumber: maskPII ? maskPhone(u.phone_number) : u.phone_number, year: u.year };
}

// GET /api/users
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { search } = req.query;
    let filter = {};
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedSearch, 'i');
      filter = { $or: [{ name: regex }, { student_id: regex }, { email: regex }] };
    }
    const rows = await User.find(filter).sort({ created_at: -1 }).lean();
    res.json(rows.map(r => formatUser(r, true)));
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
    const assignedRole = role || 'voter';
    if (!['voter', 'admin', 'auditor'].includes(assignedRole)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }
    let hash = null;

    if (assignedRole !== 'voter') {
      if (!password) return res.status(400).json({ error: 'A secure password is required for administrative accounts.' });
      hash = bcrypt.hashSync(password, 10);
    }

    await User.create({ _id: id, student_id: studentId, name, email, password_hash: hash, department_id: departmentId || null, role: assignedRole, phone_number: phoneNumber || null, year: year || null });
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
    const { name, studentId, email, role, status, departmentId, phoneNumber, year } = req.body;
    if (role !== undefined && !['voter', 'admin', 'auditor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (studentId !== undefined) {
      const cleanStudentId = studentId.trim();
      if (!cleanStudentId) return res.status(400).json({ error: 'Student ID cannot be empty.' });
      const existing = await User.findOne({ student_id: cleanStudentId, _id: { $ne: req.params.id } }).lean();
      if (existing) return res.status(409).json({ error: 'Student ID already registered by another user.' });
      updates.student_id = cleanStudentId;
    }
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
    const password = req.headers['x-admin-password'];
    if (!password) {
      return res.status(403).json({ error: 'Administrative action confirmation password is required.' });
    }

    const adminUser = await User.findById(req.user.id).select('password_hash').lean();
    if (!adminUser || !adminUser.password_hash) {
      return res.status(401).json({ error: 'Account credentials verification failed.' });
    }

    const isValid = bcrypt.compareSync(password, adminUser.password_hash);
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid administrative password confirmation.' });
    }

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

// POST /api/users/import — bulk import with validation and transaction safeguards
router.post('/import', authenticate, authorize('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { users, resolveStrategy } = req.body;
    if (!Array.isArray(users) || !users.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'An array of users is required.' });
    }

    const allDepts = await Department.find().lean();
    const validationErrors = [];
    const studentIdSet = new Set();

    // 1st Pass: Validation & Deduplication checks in batch
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const rowNum = i + 1;

      if (!u.name || typeof u.name !== 'string' || u.name.trim().length === 0) {
        validationErrors.push(`Row ${rowNum}: Name is required.`);
      }
      if (!u.studentId || typeof u.studentId !== 'string' || u.studentId.trim().length === 0) {
        validationErrors.push(`Row ${rowNum}: Student ID is required.`);
      } else {
        const cleanId = u.studentId.trim();
        if (studentIdSet.has(cleanId)) {
          validationErrors.push(`Row ${rowNum}: Duplicate Student ID "${cleanId}" detected in same batch.`);
        }
        studentIdSet.add(cleanId);
      }
      if (!u.email || typeof u.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email.trim())) {
        validationErrors.push(`Row ${rowNum}: Valid email address header is required.`);
      }
      if (u.role && !['voter', 'admin', 'auditor'].includes(u.role)) {
        validationErrors.push(`Row ${rowNum}: Role "${u.role}" must match voter, admin, or auditor.`);
      }
    }

    if (validationErrors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Import validation failed.', details: validationErrors });
    }

    // Duplicate Check against DB (names, studentIds, emails, phones)
    const names = users.map(u => u.name.trim()).filter(Boolean);
    const studentIds = users.map(u => u.studentId.trim()).filter(Boolean);
    const emails = users.map(u => u.email.trim()).filter(Boolean);
    const phones = users.map(u => {
      let p = u.phone || u.phoneNumber || u.phone_number;
      if (p) {
        p = String(p).trim();
        if (/^\d{9,10}$/.test(p) && !p.startsWith('0')) p = '0' + p;
      }
      return p;
    }).filter(Boolean);

    const existingUsers = await User.find({
      $or: [
        { name: { $in: names } },
        { student_id: { $in: studentIds } },
        { email: { $in: emails } },
        { phone_number: { $in: phones } }
      ]
    }).lean();

    const conflicts = [];
    for (const u of users) {
      const uPhone = (() => {
        let p = u.phone || u.phoneNumber || u.phone_number;
        if (p) {
          p = String(p).trim();
          if (/^\d{9,10}$/.test(p) && !p.startsWith('0')) p = '0' + p;
        }
        return p;
      })();

      const match = existingUsers.find(ex =>
        ex.student_id === u.studentId.trim() ||
        ex.name.trim().toLowerCase() === u.name.trim().toLowerCase() ||
        ex.email.trim().toLowerCase() === u.email.trim().toLowerCase() ||
        (uPhone && ex.phone_number === uPhone)
      );

      if (match) {
        let reason = '';
        if (match.student_id === u.studentId.trim()) reason = `Reference ID '${u.studentId}' already exists`;
        else if (match.name.trim().toLowerCase() === u.name.trim().toLowerCase()) reason = `Name '${u.name}' already exists`;
        else if (match.email.trim().toLowerCase() === u.email.trim().toLowerCase()) reason = `Email '${u.email}' already exists`;
        else if (uPhone && match.phone_number === uPhone) reason = `Phone number '${uPhone}' already exists`;

        conflicts.push({
          user: u,
          existingUser: {
            name: match.name,
            studentId: match.student_id,
            email: match.email,
            phoneNumber: match.phone_number
          },
          reason
        });
      }
    }

    if (conflicts.length > 0 && !resolveStrategy) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        error: 'import_conflicts',
        message: 'Duplicate voter records found.',
        conflicts
      });
    }

    let usersToImport = users;
    if (resolveStrategy === 'reject') {
      usersToImport = users.filter(u => {
        const uPhone = (() => {
          let p = u.phone || u.phoneNumber || u.phone_number;
          if (p) {
            p = String(p).trim();
            if (/^\d{9,10}$/.test(p) && !p.startsWith('0')) p = '0' + p;
          }
          return p;
        })();

        return !existingUsers.some(ex =>
          ex.student_id === u.studentId.trim() ||
          ex.name.trim().toLowerCase() === u.name.trim().toLowerCase() ||
          ex.email.trim().toLowerCase() === u.email.trim().toLowerCase() ||
          (uPhone && ex.phone_number === uPhone)
        );
      });
    }

    if (!usersToImport.length) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ message: 'No new voters were imported; all conflicting records were rejected.', count: 0 });
    }

    // 2nd Pass: Write DB transactions under validation consistency
    let importedCount = 0;
    for (const u of usersToImport) {
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
        { student_id: u.studentId.trim() },
        {
          $set: {
            name: u.name.trim(),
            email: u.email.trim(),
            department_id: departmentId || undefined,
            phone_number: phoneNumber || undefined,
            year: u.year || undefined
          },
          $setOnInsert: {
            _id: id,
            student_id: u.studentId.trim(),
            password_hash: hash,
            role: role,
            status: 'active'
          }
        },
        { upsert: true, session }
      );
      importedCount++;
    }

    await AuditLog.create([{
      _id: `log-${Date.now()}`,
      action: 'Bulk Users Imported',
      performed_by: req.user.name,
      role: 'Admin',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ count: importedCount })
    }], { session });

    await session.commitTransaction();
    session.endSession();
    res.json({ message: `Successfully imported ${importedCount} users.`, count: importedCount });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import users.' });
  }
});

// GET /api/users/:id — Retrieve full PII with strict audit logging
router.get('/:id', authenticate, authorize('admin', 'auditor'), async (req, res) => {
  try {
    const userObj = await User.findById(req.params.id).lean();
    if (!userObj) return res.status(404).json({ error: 'User not found.' });

    // Audited action
    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: 'Access User PII',
      performed_by: req.user.name,
      role: req.user.role === 'admin' ? 'Admin' : 'Auditor',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ accessedUserId: userObj._id, studentId: userObj.student_id })
    });

    res.json(formatUser(userObj, false));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
