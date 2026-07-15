// ============================================
// MODEL — User (Mongoose)
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },           // e.g. 'user-1720000000000'
  student_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password_hash: { type: String, default: null },   // null for OTP-only voters
  department_id: { type: String, default: null, ref: 'Department' },
  role: { type: String, required: true, enum: ['voter', 'admin', 'auditor'], default: 'voter' },
  status: { type: String, required: true, default: 'active' },
  phone_number: { type: String, default: null },
  year: { type: String, default: null },
  otp_code: { type: String, default: null },
  otp_expires: { type: Date, default: null },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  collection: 'users',
});

export default mongoose.model('User', userSchema);
