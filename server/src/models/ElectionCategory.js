// ============================================
// MODEL — ElectionCategory (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const electionCategorySchema = new mongoose.Schema({
  election_id: { type: String, required: true, ref: 'Election' },
  name: { type: String, required: true },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  collection: 'election_categories',
});

// Compound unique index
electionCategorySchema.index({ election_id: 1, name: 1 }, { unique: true });

export default mongoose.model('ElectionCategory', electionCategorySchema);
