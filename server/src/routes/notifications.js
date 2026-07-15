// ============================================
// NOTIFICATION ROUTES — Real-time Notification System
// UniVote ACSES UMaT E-Voting System
// ============================================
import { Router } from 'express';
import Notification from '../models/Notification.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * Emit a notification (helper used by other modules).
 * Creates a notification record in the database.
 */
export async function emitNotification({ text, category = 'system', userId = null, roleTarget = null, metadata = null }) {
    try {
        const notif = await Notification.create({
            _id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            user_id: userId,
            role_target: roleTarget,
            text,
            category,
            metadata: metadata ? JSON.stringify(metadata) : null,
        });
        return notif;
    } catch (err) {
        console.error('⚠️  Failed to emit notification:', err.message);
        return null;
    }
}

// GET /api/notifications — fetch notifications for the current user
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);

        // Auto-seed some starting alerts if the DB has no notifications at all
        const totalCount = await Notification.countDocuments();
        if (totalCount === 0) {
            const defaultAlerts = [
                {
                    _id: `notif-seed-1`,
                    text: 'ACSES Executive Election: 197 votes cast so far.',
                    category: 'election',
                    role_target: null,
                    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5m ago
                },
                {
                    _id: `notif-seed-2`,
                    text: 'Off-hours access attempt detected and logged system-wide.',
                    category: 'security',
                    role_target: 'admin',
                    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h ago
                },
                {
                    _id: `notif-seed-3`,
                    text: 'CSE Level 300 Class Rep results have been locked and hashes verified.',
                    category: 'result',
                    role_target: null,
                    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3d ago
                },
                {
                    _id: `notif-seed-4`,
                    text: 'Mining Engineering SRC election draft created and pending candidate registry.',
                    category: 'election',
                    role_target: 'admin',
                    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() // 4d ago
                }
            ];
            await Notification.insertMany(defaultAlerts).catch(() => { });
        }

        // Fetch notifications targeted to:
        // 1. This specific user (user_id match)
        // 2. This user's role (role_target match)
        // 3. Broadcast (both user_id and role_target are null)
        const notifications = await Notification.find({
            $or: [
                { user_id: userId },
                { role_target: userRole },
                { user_id: null, role_target: null },
            ]
        })
            .sort({ created_at: -1 })
            .limit(limit)
            .lean();

        res.json(notifications.map(n => ({
            id: n._id,
            text: n.text,
            category: n.category,
            read: n.read,
            time: n.created_at,
            metadata: n.metadata ? JSON.parse(n.metadata) : null,
        })));
    } catch (err) {
        console.error('Fetch notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const count = await Notification.countDocuments({
            read: false,
            $or: [
                { user_id: userId },
                { role_target: userRole },
                { user_id: null, role_target: null },
            ]
        });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: 'Failed to count notifications.' });
    }
});

// POST /api/notifications/:id/read — mark single notification as read
router.post('/:id/read', authenticate, async (req, res) => {
    try {
        await Notification.updateOne({ _id: req.params.id }, { read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
});

// POST /api/notifications/read-all — mark all as read for current user
router.post('/read-all', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        await Notification.updateMany(
            {
                read: false,
                $or: [
                    { user_id: userId },
                    { role_target: userRole },
                    { user_id: null, role_target: null },
                ]
            },
            { read: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark all as read.' });
    }
});

// POST /api/notifications/broadcast — admin broadcasts a notification
router.post('/broadcast', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { text, category, roleTarget } = req.body;
        if (!text) return res.status(400).json({ error: 'Notification text is required.' });

        const notif = await emitNotification({
            text,
            category: category || 'announcement',
            roleTarget: roleTarget || null,
        });
        res.json(notif);
    } catch (err) {
        res.status(500).json({ error: 'Failed to broadcast notification.' });
    }
});

export default router;
