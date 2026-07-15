// ============================================
// MODEL — VoteRecord (Mongoose) — Blockchain Ledger
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const voteRecordSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // block hash (sha256)
  block_index: { type: Number, required: true },
  election_id: { type: String, required: true, ref: 'Election' },
  candidate_ids: { type: String, required: true },  // JSON string of candidate IDs
  vote_hash: { type: String, required: true },
  timestamp: { type: String, required: true },
  previous_hash: { type: String, required: true },
  nonce: { type: Number, required: true },
}, {
  collection: 'vote_records',
});

export default mongoose.model('VoteRecord', voteRecordSchema);
