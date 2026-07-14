// ============================================
// MODEL — AuditLog (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // e.g. 'log-1720000000000'
  action: { type: String, required: true },
  performed_by: { type: String, required: true },
  role: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  metadata: { type: String, default: null },       // JSON string
}, {
  collection: 'audit_logs',
});

export default mongoose.model('AuditLog', auditLogSchema);
