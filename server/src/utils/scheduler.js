// ============================================
// SCHEDULER — Background Jobs
// UniVote ACSES UMaT E-Voting System
// ============================================
import Election from '../models/Election.js';
import AuditLog from '../models/AuditLog.js';

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
 * Initializes background scheduler jobs.
 */
export function initScheduler() {
    console.log('⏰ Background Scheduler Initialized: Checking for ended elections every 30 seconds.');

    // Run once immediately on start
    autoCloseElections();

    // Run every 30 seconds
    setInterval(autoCloseElections, 30 * 1000);
}
