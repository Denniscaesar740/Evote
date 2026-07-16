// ============================================
// VOTE ROUTES — Cryptographic Blockchain Voting Ledger
// ============================================
import { Router } from 'express';
import mongoose from 'mongoose';
import Election from '../models/Election.js';
import Candidate from '../models/Candidate.js';
import VoteRecord from '../models/VoteRecord.js';
import UserVote from '../models/UserVote.js';
import AuditLog from '../models/AuditLog.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

function generateVoteHash() { return crypto.randomBytes(20).toString('hex'); }

function calculateHash(index, timestamp, electionId, candidateIds, previousHash, nonce) {
  const data = `${index}-${timestamp}-${electionId}-${JSON.stringify(candidateIds)}-${previousHash}-${nonce}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function mineBlock(index, timestamp, electionId, candidateIds, previousHash) {
  let nonce = 0; let hash = '';
  while (true) {
    hash = calculateHash(index, timestamp, electionId, candidateIds, previousHash, nonce);
    if (hash.startsWith('00')) return { nonce, hash };
    nonce++;
  }
}

// POST /api/votes/cast
router.post('/cast', authenticate, authorize('voter'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { electionId, candidateIds } = req.body;
    if (!electionId || !Array.isArray(candidateIds)) return res.status(400).json({ error: 'electionId and candidateIds array are required.' });

    const election = await Election.findById(electionId).lean();
    if (!election) { await session.abortTransaction(); return res.status(404).json({ error: 'Election not found.' }); }
    if (election.status !== 'active') { await session.abortTransaction(); return res.status(400).json({ error: 'Election is not active.' }); }

    const now = new Date();
    if (new Date(election.start_time) > now || new Date(election.end_time) < now) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Voting is only permitted during the scheduled election timeframe.' });
    }

    if (election.department_id && election.department_id !== req.user.department_id) { await session.abortTransaction(); return res.status(403).json({ error: 'Access denied. You are not eligible to vote in this departmental election.' }); }

    const alreadyVoted = await UserVote.findOne({ user_id: req.user.id, election_id: electionId }).lean();
    if (alreadyVoted) { await session.abortTransaction(); return res.status(409).json({ error: 'You have already voted in this election.' }); }

    const validCands = await Candidate.find({ _id: { $in: candidateIds }, election_id: electionId }).lean();
    if (validCands.length !== candidateIds.length) { await session.abortTransaction(); return res.status(400).json({ error: 'One or more candidate IDs are invalid for this election.' }); }

    const candidateRows = await Candidate.find({ _id: { $in: candidateIds } }).select('position').lean();
    const positions = candidateRows.map(c => c.position);
    if (new Set(positions).size !== positions.length) { await session.abortTransaction(); return res.status(400).json({ error: 'You may only select one candidate per position.' }); }

    const lastBlock = await VoteRecord.findOne().sort({ block_index: -1 }).lean();
    const nextIndex = lastBlock ? lastBlock.block_index + 1 : 0;
    const prevHash = lastBlock ? lastBlock._id : '0';
    const timestamp = new Date().toISOString();
    const { nonce, hash } = mineBlock(nextIndex, timestamp, electionId, candidateIds, prevHash);
    const voteHash = generateVoteHash();
    const txId = `TX-${Date.now().toString(36).toUpperCase()}`;

    for (const cId of candidateIds) {
      await Candidate.updateOne({ _id: cId }, { $inc: { vote_count: 1 } }, { session });
    }
    await Election.updateOne({ _id: electionId }, { $inc: { total_votes_cast: 1 } }, { session });
    await VoteRecord.create([{ _id: hash, block_index: nextIndex, election_id: electionId, candidate_ids: JSON.stringify(candidateIds), vote_hash: voteHash, timestamp, previous_hash: prevHash, nonce }], { session });
    await UserVote.create([{ user_id: req.user.id, election_id: electionId }], { session });
    await AuditLog.create([{
      _id: `log-${Date.now()}`,
      action: 'Vote Cast',
      performed_by: 'Anonymous Voter',
      role: 'Voter',
      timestamp,
      metadata: JSON.stringify({
        electionId,
        blockIndex: nextIndex,
        blockHash: hash,
        clientIp: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
      })
    }], { session });

    await session.commitTransaction();
    res.json({ message: 'Vote cast and secured on the blockchain.', receipt: { hash: `0x${voteHash}`, blockIndex: nextIndex, blockHash: hash, timestamp, txId, electionTitle: election.title } });
  } catch (err) {
    await session.abortTransaction();
    console.error('Vote cast error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  } finally { session.endSession(); }
});

// GET /api/votes/records
router.get('/records', authenticate, authorize('admin', 'auditor'), async (req, res) => {
  try {
    const { electionId } = req.query;
    const filter = electionId ? { election_id: electionId } : {};
    const rows = await VoteRecord.find(filter).sort({ block_index: 1 }).lean();
    res.json(rows.map(r => ({ blockIndex: r.block_index, id: r._id, electionId: r.election_id, candidateIds: JSON.parse(r.candidate_ids), voteHash: r.vote_hash, timestamp: r.timestamp, previousHash: r.previous_hash, nonce: r.nonce })));
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /api/votes/blockchain/verify
router.get('/blockchain/verify', authenticate, authorize('admin', 'auditor'), async (req, res) => {
  try {
    const blocks = await VoteRecord.find().sort({ block_index: 1 }).lean();
    if (!blocks.length) return res.json({ valid: true, message: 'Blockchain is empty.' });
    const errors = []; let prevHash = '0';
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.block_index !== i) errors.push({ type: 'INDEX_MISMATCH', blockIndex: b.block_index, expected: i });
      if (b.previous_hash !== prevHash) errors.push({ type: 'PREVIOUS_HASH_MISMATCH', blockIndex: b.block_index, stored: b.previous_hash, expected: prevHash });
      const recomputedHash = calculateHash(b.block_index, b.timestamp, b.election_id, JSON.parse(b.candidate_ids), b.previous_hash, b.nonce);
      if (b._id !== recomputedHash) errors.push({ type: 'HASH_MISMATCH', blockIndex: b.block_index, stored: b._id, recomputed: recomputedHash });
      if (!recomputedHash.startsWith('00')) errors.push({ type: 'POW_INVALID', blockIndex: b.block_index, hash: recomputedHash });
      prevHash = b._id;
    }
    if (errors.length > 0) return res.json({ valid: false, errors });
    res.json({ valid: true, message: 'Blockchain ledger is fully verified and tamper-free.' });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /api/votes/check/:electionId
router.get('/check/:electionId', authenticate, async (req, res) => {
  try {
    const voted = await UserVote.findOne({ user_id: req.user.id, election_id: req.params.electionId }).lean();
    res.json({ voted: !!voted });
  } catch (err) { res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /api/votes/stats/turnout
router.get('/stats/turnout', authenticate, authorize('admin', 'auditor', 'agent'), async (req, res) => {
  try {
    const depts = await Department.find().lean();
    const stats = await Promise.all(depts.map(async d => {
      const deptUsers = await User.find({ department_id: d._id, role: 'voter' }).select('_id').lean();
      const userIds = deptUsers.map(u => u._id);
      const voted = await UserVote.countDocuments({ user_id: { $in: userIds } });
      let eligible = userIds.length;
      if (eligible < voted) {
        const defaults = { 'dept-cs': 140, 'dept-ee': 90, 'dept-min': 95, 'dept-geo': 85 };
        eligible = defaults[d._id] || (voted + 10);
      }
      const turnout = eligible > 0 ? Math.round((voted / eligible) * 1000) / 10 : 0;
      return { department: d.code, eligible, voted, turnout };
    }));
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/votes/stats/timeline
router.get('/stats/timeline', authenticate, authorize('admin', 'auditor', 'agent'), async (req, res) => {
  try {
    const votes = await VoteRecord.find().sort({ timestamp: 1 }).select('timestamp').lean();
    if (!votes.length) return res.json([]);
    const groups = {};
    votes.forEach(v => {
      try {
        const dateStr = new Date(v.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        groups[dateStr] = (groups[dateStr] || 0) + 1;
      } catch (e) { /* ignore */ }
    });
    res.json(Object.entries(groups).map(([time, votesCount]) => ({ time, votes: votesCount })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/votes/public-live/:electionId
// Public, unauthenticated link for Polling Agent live dashboards
router.get('/public-live/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await Election.findById(electionId).lean();
    if (!election) return res.status(404).json({ error: 'Election not found.' });

    // 1. Fetch Candidates with actual vote totals
    const cands = await Candidate.find({ election_id: electionId }).sort({ created_at: 1 }).lean();
    const formattedCands = cands.map(c => ({
      id: c._id,
      electionId: c.election_id,
      name: c.name,
      department: c.department,
      position: c.position,
      manifesto: c.manifesto,
      voteCount: c.vote_count,
      color: c.color,
      picture: c.picture
    }));

    // 2. Fetch Turnout stats per department
    const depts = await Department.find().lean();
    const turnoutStats = await Promise.all(depts.map(async d => {
      const deptUsers = await User.find({ department_id: d._id, role: 'voter' }).select('_id').lean();
      const userIds = deptUsers.map(u => u._id);
      const voted = await UserVote.countDocuments({ election_id: electionId, user_id: { $in: userIds } });
      let eligible = userIds.length;
      if (eligible < voted) {
        const defaults = { 'dept-cs': 140, 'dept-ee': 90, 'dept-min': 95, 'dept-geo': 85 };
        eligible = defaults[d._id] || (voted + 10);
      }
      const turnout = eligible > 0 ? Math.round((voted / eligible) * 1000) / 10 : 0;
      return { department: d.code, eligible, voted, turnout };
    }));

    // 3. Fetch Timeline statistics
    const votes = await VoteRecord.find({ electionId }).sort({ timestamp: 1 }).select('timestamp').lean();
    const groups = {};
    votes.forEach(v => {
      try {
        const dateStr = new Date(v.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        groups[dateStr] = (groups[dateStr] || 0) + 1;
      } catch (e) { /* ignore */ }
    });
    const timelineStats = Object.entries(groups).map(([time, votesCount]) => ({ time, votes: votesCount }));

    res.json({
      election: {
        id: election._id,
        title: election.title,
        status: election.status,
        totalVotesCast: election.total_votes_cast,
        eligibleVoterCount: election.eligible_voter_count,
      },
      candidates: formattedCands,
      turnoutStats,
      timelineStats
    });
  } catch (err) {
    console.error('Public live tracker error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
