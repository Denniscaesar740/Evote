// ============================================
// MODEL — Notification (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    user_id: { type: String, default: null },           // null = broadcast to all
    role_target: { type: String, default: null },        // null = all, or 'admin', 'voter', 'auditor'
    text: { type: String, required: true },
    category: { type: String, enum: ['election', 'security', 'system', 'result', 'announcement'], default: 'system' },
    read: { type: Boolean, default: false },
    metadata: { type: String, default: null },           // JSON string for extra context
    created_at: { type: String, default: () => new Date().toISOString() },
}, {
    collection: 'notifications',
});

notificationSchema.index({ user_id: 1, read: 1 });
notificationSchema.index({ role_target: 1, created_at: -1 });

export default mongoose.model('Notification', notificationSchema);
