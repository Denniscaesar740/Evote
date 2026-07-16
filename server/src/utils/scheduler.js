// ============================================
// SCHEDULER — Background Jobs
// UniVote ACSES UMaT E-Voting System
// ============================================
import Election from '../models/Election.js';
import Candidate from '../models/Candidate.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Checks for any scheduled elections that have reached/passed their start time,
 * and automatically marks them as 'active'. Logs to the audit log.
 */
export async function autoStartElections() {
    try {
        const now = new Date();
        // Find elections that are scheduled
        const scheduledElections = await Election.find({ status: 'scheduled' });

        for (const election of scheduledElections) {
            const startTime = new Date(election.start_time);
            const endTime = new Date(election.end_time);

            // If start time is reached/passed and end time is inside future
            if (!isNaN(startTime.getTime()) && startTime <= now && (isNaN(endTime.getTime()) || endTime > now)) {
                // Ensure the election has candidates before starting it
                const candCount = await Candidate.countDocuments({ election_id: election._id });
                if (candCount > 0) {
                    await Election.updateOne(
                        { _id: election._id },
                        { $set: { status: 'active' } }
                    );

                    console.log(`[Scheduler] 🗳️  Automatically activated election: "${election.title}" (ID: ${election._id})`);

                    await AuditLog.create({
                        _id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        action: 'Election Published',
                        performed_by: 'System Scheduler',
                        role: 'System',
                        timestamp: now.toISOString(),
                        metadata: JSON.stringify({
                            electionId: election._id,
                            title: election.title,
                            reason: 'Automatically started by system scheduler at scheduled start time.',
                            startTime: election.start_time
                        })
                    });
                } else {
                    console.log(`[Scheduler] ⚠️  Cannot auto-start scheduled election without candidates: "${election.title}" (ID: ${election._id})`);
                }
            }
        }
    } catch (err) {
        console.error('[Scheduler ERROR] Failed to run autoStartElections:', err);
    }
}

/**
 * Checks for any active elections that have reached/passed their end time,
 * and automatically marks them as 'closed'. Also logs the action to the audit trail.
 */
export async function autoCloseElections() {
    try {
        const now = new Date();
        // Find all elections that are currently active
        const activeElections = await Election.find({ status: 'active' });

        for (const election of activeElections) {
            const endTime = new Date(election.end_time);

            // If the end time is valid and has passed, close the election
            if (!isNaN(endTime.getTime()) && endTime <= now) {
                await Election.updateOne(
                    { _id: election._id },
                    { $set: { status: 'closed' } }
                );

                console.log(`[Scheduler] 🗳️  Automatically closed election: "${election.title}" (ID: ${election._id}) since its end time was reached.`);

                // Log the action to the Audit Trail
                await AuditLog.create({
                    _id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    action: 'Election Closed',
                    performed_by: 'System Scheduler',
                    role: 'System',
                    timestamp: now.toISOString(),
                    metadata: JSON.stringify({
                        electionId: election._id,
                        title: election.title,
                        reason: 'Automatically closed by system scheduler at scheduled end time.',
                        endTime: election.end_time
                    })
                });
            }
        }
    } catch (err) {
        console.error('[Scheduler ERROR] Failed to run autoCloseElections:', err);
    }
}

/**
 * Run all scheduled election jobs.
 */
export async function runSchedulerJobs() {
    await autoStartElections();
    await autoCloseElections();
}

/**
 * Initializes background scheduler jobs.
 */
export function initScheduler() {
    console.log('⏰ Background Scheduler Initialized: Checking for active/scheduled elections every 30 seconds.');

    // Run once immediately on start
    runSchedulerJobs();

    // Run every 30 seconds
    setInterval(runSchedulerJobs, 30 * 1000);
}
