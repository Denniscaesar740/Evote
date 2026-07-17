// ============================================
// MODEL — Anomaly (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const anomalySchema = new mongoose.Schema({
  _id: { type: String, required: true },
  type: { type: String, required: true },
  desc: { type: String, required: true },
  cleared: { type: Number, required: true, default: 0 },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  collection: 'anomalies',
});

export default mongoose.model('Anomaly', anomalySchema);
