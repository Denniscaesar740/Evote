// ============================================
// HEALTH CHECK ROUTES — Real Cryptographic System Diagnostics
// UniVote ACSES UMaT E-Voting System
// ============================================
import { Router } from 'express';
import crypto from 'crypto';
import VoteRecord from '../models/VoteRecord.js';
import UserVote from '../models/UserVote.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * Recalculate a block hash (mirrors the vote casting logic).
 */
function calculateHash(index, timestamp, electionId, candidateIds, previousHash, nonce) {
    const data = `${index}-${timestamp}-${electionId}-${JSON.stringify(candidateIds)}-${previousHash}-${nonce}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

// GET /api/health-checks/all — Run ALL health checks and return structured results
router.get('/all', authenticate, authorize('admin', 'auditor'), async (req, res) => {
    try {
        const results = [];
        const startTime = Date.now();

        // ── CHECK 1: DB Cryptographic Signature Validation ──
        const check1Start = Date.now();
        const blocks = await VoteRecord.find().sort({ block_index: 1 }).lean();
        let signatureErrors = 0;
        for (const b of blocks) {
            const recomputed = calculateHash(
                b.block_index, b.timestamp, b.election_id,
                JSON.parse(b.candidate_ids), b.previous_hash, b.nonce
            );
            if (b._id !== recomputed) signatureErrors++;
        }
        results.push({
            id: 'db_signature',
            title: 'DB Cryptographic Signature',
            desc: 'Validates database rows have not been altered or injected externally.',
            status: signatureErrors === 0 ? 'healthy' : 'critical',
            value: signatureErrors === 0
                ? `SHA-256 Validated (${blocks.length} blocks)`
                : `${signatureErrors} signature mismatch${signatureErrors > 1 ? 'es' : ''} detected`,
            durationMs: Date.now() - check1Start,
        });

        // ── CHECK 2: Block Time Sequence Audit ──
        const check2Start = Date.now();
        let timeErrors = 0;
        let maxDeviation = 0;
        for (let i = 1; i < blocks.length; i++) {
            const prevTime = new Date(blocks[i - 1].timestamp).getTime();
            const currTime = new Date(blocks[i].timestamp).getTime();
            const diff = currTime - prevTime;
            if (diff < 0) timeErrors++;
            maxDeviation = Math.max(maxDeviation, Math.abs(diff < 0 ? diff : 0));
        }
        results.push({
            id: 'time_sequence',
            title: 'Block Time Sequence Audit',
            desc: 'Validates timestamps align sequentially without chronological anomalies.',
            status: timeErrors === 0 ? 'healthy' : 'warning',
            value: timeErrors === 0
                ? `Sequential order verified (${blocks.length} blocks, 0.00ms deviation)`
                : `${timeErrors} chronological anomal${timeErrors > 1 ? 'ies' : 'y'} detected (${maxDeviation.toFixed(2)}ms max deviation)`,
            durationMs: Date.now() - check2Start,
        });

        // ── CHECK 3: Ledger Cross-Reference ──
        const check3Start = Date.now();
        const ledgerCount = blocks.length;
        const userVoteCount = await UserVote.countDocuments();
        const crossRefMatch = ledgerCount === userVoteCount;
        results.push({
            id: 'ledger_crossref',
            title: 'Ledger Cross-Reference',
            desc: 'Cross-checks hasVoted counts against anonymized ledger entry totals.',
            status: crossRefMatch ? 'healthy' : 'warning',
            value: crossRefMatch
                ? `${ledgerCount} ledger records = ${userVoteCount} voter records (match)`
                : `Mismatch: ${ledgerCount} ledger entries ≠ ${userVoteCount} voter entries`,
            durationMs: Date.now() - check3Start,
        });

        // ── CHECK 4: Double-Vote Prevention Audit ──
        const check4Start = Date.now();
        const duplicates = await UserVote.aggregate([
            { $group: { _id: { user: '$user_id', election: '$election_id' }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        const duplicateCount = duplicates.length;
        results.push({
            id: 'double_vote',
            title: 'Double-Vote Prevention',
            desc: 'Audits UserVote collection for duplicate voting tokens across sessions.',
            status: duplicateCount === 0 ? 'healthy' : 'critical',
            value: duplicateCount === 0
                ? `0 duplicate events detected (${userVoteCount} votes audited)`
                : `${duplicateCount} duplicate vote${duplicateCount > 1 ? 's' : ''} detected — INTEGRITY BREACH`,
            durationMs: Date.now() - check4Start,
        });

        // ── CHECK 5: Proof of Work Validation ──
        const check5Start = Date.now();
        let powFailures = 0;
        for (const b of blocks) {
            if (!b._id.startsWith('00')) powFailures++;
        }
        results.push({
            id: 'pow_validation',
            title: 'Proof of Work Consensus',
            desc: 'Validates that all block hashes meet the required difficulty prefix (00).',
            status: powFailures === 0 ? 'healthy' : 'critical',
            value: powFailures === 0
                ? `All ${blocks.length} blocks satisfy PoW difficulty '00'`
                : `${powFailures} block${powFailures > 1 ? 's' : ''} failed PoW validation`,
            durationMs: Date.now() - check5Start,
        });

        // ── CHECK 6: Chain Link Integrity ──
        const check6Start = Date.now();
        let linkErrors = 0;
        let prevHash = '0';
        for (const b of blocks) {
            if (b.previous_hash !== prevHash) linkErrors++;
            prevHash = b._id;
        }
        results.push({
            id: 'chain_links',
            title: 'Chain Link Integrity',
            desc: 'Validates each block correctly references the hash of its predecessor.',
            status: linkErrors === 0 ? 'healthy' : 'critical',
            value: linkErrors === 0
                ? `${blocks.length} blocks correctly chained (genesis → head)`
                : `${linkErrors} broken chain link${linkErrors > 1 ? 's' : ''} detected`,
            durationMs: Date.now() - check6Start,
        });

        const allHealthy = results.every(r => r.status === 'healthy');
        const hasCritical = results.some(r => r.status === 'critical');

        res.json({
            overallStatus: hasCritical ? 'critical' : allHealthy ? 'healthy' : 'warning',
            totalDurationMs: Date.now() - startTime,
            checksRun: results.length,
            blocksAudited: blocks.length,
            timestamp: new Date().toISOString(),
            checks: results,
        });
    } catch (err) {
        console.error('Health checks error:', err);
        res.status(500).json({ error: 'Failed to run health checks.' });
    }
});

export default router;
