// ============================================
// MODEL — Department (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // e.g. 'dept-cs'
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  faculty: { type: String, required: true },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  collection: 'departments',
});

export default mongoose.model('Department', departmentSchema);
