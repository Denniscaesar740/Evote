// ============================================
// MODEL — ElectionRule (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const electionRuleSchema = new mongoose.Schema({
  election_id: { type: String, required: true, ref: 'Election' },
  rule_text: { type: String, required: true },
  sort_order: { type: Number, required: true, default: 0 },
}, {
  collection: 'election_rules',
});

export default mongoose.model('ElectionRule', electionRuleSchema);
