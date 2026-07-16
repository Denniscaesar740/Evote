// ============================================
// ELECTION ROUTES — Full CRUD + category/rules management
// ============================================
import { Router } from 'express';
import Election from '../models/Election.js';
import ElectionCategory from '../models/ElectionCategory.js';
import ElectionRule from '../models/ElectionRule.js';
import Candidate from '../models/Candidate.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Helper: build full election object with categories and rules
async function buildElection(row) {
  const categories = (await ElectionCategory.find({ election_id: row._id }).sort('_id').lean()).map(c => c.name);
  const rules = (await ElectionRule.find({ election_id: row._id }).sort('sort_order').lean()).map(r => r.rule_text);
  return {
    id: row._id,
    title: row.title,
    description: row.description,
    departmentId: row.department_id,
    type: row.type,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    eligibleVoterCount: row.eligible_voter_count,
    totalVotesCast: row.total_votes_cast,
    createdBy: row.created_by,
    categories,
    rules,
  };
}

// GET /api/elections — list all elections
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'voter') {
      filter.status = { $ne: 'draft' };
    }
    const rows = await Election.find(filter).sort({ created_at: -1 }).lean();
    const elections = await Promise.all(rows.map(buildElection));
    res.json(elections);
  } catch (err) {
    console.error('Get elections error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/elections/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const row = await Election.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ error: 'Election not found.' });
    res.json(await buildElection(row));
  } catch (err) {
    console.error('Get election error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/elections — create election (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, description, departmentId, type, startTime, endTime, eligibleVoterCount, categories, rules } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, startTime, and endTime are required.' });
    }

    const id = `elec-${Date.now()}`;
    await Election.create({
      _id: id,
      title,
      description: description || '',
      department_id: departmentId || null,
      type: type || 'Student Representative',
      status: 'draft',
      start_time: startTime,
      end_time: endTime,
      eligible_voter_count: eligibleVoterCount || 100,
      total_votes_cast: 0,
      created_by: req.user.name,
    });

    // Insert categories
    if (categories?.length) {
      await ElectionCategory.insertMany(
        categories.map(cat => ({ election_id: id, name: cat }))
      );
    }

    // Insert rules
    if (rules?.length) {
      await ElectionRule.insertMany(
        rules.map((rule, i) => ({ election_id: id, rule_text: rule, sort_order: i }))
      );
    }

    // Audit
    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: 'Election Created',
      performed_by: req.user.name,
      role: 'Admin',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ electionId: id, title }),
    });

    const created = await Election.findById(id).lean();
    res.status(201).json(await buildElection(created));
  } catch (err) {
    console.error('Create election error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/elections/:id — update election (admin only)
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id).lean();
    if (!election) return res.status(404).json({ error: 'Election not found.' });

    const { title, description, status, startTime, endTime, eligibleVoterCount, type, departmentId } = req.body;

    const targetStartTime = new Date(startTime !== undefined ? startTime : election.start_time);
    const targetEndTime = new Date(endTime !== undefined ? endTime : election.end_time);
    let resolvedStatus = status !== undefined ? status : election.status;
    const now = new Date();

    if (resolvedStatus === 'active' || resolvedStatus === 'scheduled') {
      if (targetStartTime > now) {
        resolvedStatus = 'scheduled';
      } else if (targetEndTime <= now) {
        resolvedStatus = 'closed';
      } else {
        const candCount = await Candidate.countDocuments({ election_id: req.params.id });
        if (candCount > 0) {
          resolvedStatus = 'active';
        } else {
          resolvedStatus = 'scheduled';
        }
      }
    }

    if (resolvedStatus === 'active') {
      const candCount = await Candidate.countDocuments({ election_id: req.params.id });
      if (candCount === 0) return res.status(400).json({ error: 'Cannot publish election with no candidates.' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    updates.status = resolvedStatus;
    if (startTime !== undefined) updates.start_time = startTime;
    if (endTime !== undefined) updates.end_time = endTime;
    if (eligibleVoterCount !== undefined) updates.eligible_voter_count = eligibleVoterCount;
    if (type !== undefined) updates.type = type;
    if (departmentId !== undefined) updates.department_id = departmentId;

    if (Object.keys(updates).length) {
      await Election.updateOne({ _id: req.params.id }, { $set: updates });
    }

    const actionLabel = resolvedStatus === 'active' ? 'Election Published' : resolvedStatus === 'closed' ? 'Election Closed' : 'Election Updated';
    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: actionLabel,
      performed_by: req.user.name,
      role: 'Admin',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ electionId: req.params.id }),
    });

    const updated = await Election.findById(req.params.id).lean();
    res.json(await buildElection(updated));
  } catch (err) {
    console.error('Update election error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/elections/:id/categories — add a position category
router.post('/:id/categories', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' });

    const election = await Election.findById(req.params.id).lean();
    if (!election) return res.status(404).json({ error: 'Election not found.' });

    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exists = await ElectionCategory.findOne({
      election_id: req.params.id,
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    }).lean();
    if (exists) return res.status(409).json({ error: 'Category already exists.' });

    await ElectionCategory.create({ election_id: req.params.id, name: name.trim() });

    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: 'Category Added',
      performed_by: req.user.name,
      role: 'Admin',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ electionId: req.params.id, category: name.trim() }),
    });

    const updated = await Election.findById(req.params.id).lean();
    res.status(201).json(await buildElection(updated));
  } catch (err) {
    console.error('Add category error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/elections/:id/categories/:name — delete a position category (cascades candidates)
router.delete('/:id/categories/:name', authenticate, authorize('admin'), async (req, res) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);

    await ElectionCategory.deleteOne({ election_id: req.params.id, name: categoryName });
    await Candidate.deleteMany({ election_id: req.params.id, position: categoryName });

    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: 'Category Deleted',
      performed_by: req.user.name,
      role: 'Admin',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ electionId: req.params.id, category: categoryName }),
    });

    const updated = await Election.findById(req.params.id).lean();
    res.json(await buildElection(updated));
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
