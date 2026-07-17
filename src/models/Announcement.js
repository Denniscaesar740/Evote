// ============================================
// MODEL — Announcement (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // e.g. 'ann-1720000000000'
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, required: true, default: 'info' },
  target: { type: String, required: true, default: 'all' },
  timestamp: { type: String, default: () => new Date().toISOString() },
}, {
  collection: 'announcements',
});

export default mongoose.model('Announcement', announcementSchema);
