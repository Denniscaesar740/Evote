// ============================================
// MODEL — Election (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const electionSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // e.g. 'elec-1720000000000'
  title: { type: String, required: true },
  description: { type: String, default: '' },
  department_id: { type: String, default: null, ref: 'Department' },
  type: { type: String, required: true, default: 'Student Representative' },
  status: { type: String, required: true, default: 'draft' },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  eligible_voter_count: { type: Number, required: true, default: 0 },
  total_votes_cast: { type: Number, required: true, default: 0 },
  created_by: { type: String, default: null },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  collection: 'elections',
});

export default mongoose.model('Election', electionSchema);
