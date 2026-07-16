// ============================================
// MODEL — Candidate (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // e.g. 'cand-1720000000000'
  election_id: { type: String, required: true, ref: 'Election' },
  name: { type: String, required: true },
  department: { type: String, default: '' },
  position: { type: String, required: true },
  manifesto: { type: String, default: '' },
  vote_count: { type: Number, required: true, default: 0 },
  color: { type: String, default: '#2e7d32' },
  picture: { type: String, default: null },
  ballot_number: { type: Number, default: null },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  collection: 'candidates',
});

export default mongoose.model('Candidate', candidateSchema);
