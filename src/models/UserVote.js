// ============================================
// MODEL — UserVote (Mongoose) — Tracks which users voted in which elections
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const userVoteSchema = new mongoose.Schema({
  user_id: { type: String, required: true, ref: 'User' },
  election_id: { type: String, required: true, ref: 'Election' },
  voted_at: { type: Date, default: Date.now },
}, {
  collection: 'user_votes',
});

// Compound unique index — each user can only vote once per election
userVoteSchema.index({ user_id: 1, election_id: 1 }, { unique: true });

export default mongoose.model('UserVote', userVoteSchema);
