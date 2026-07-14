// ============================================
// AUTH ROUTES — Login, OTP, Register, Session
// ============================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserVote from '../models/UserVote.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate } from '../middleware/auth.js';
import { sendSMS, generateOTP } from '../utils/sms.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'univote-fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const OTP_EXPIRY_MINUTES = 10;

// Helper: build token + user response
async function buildAuthResponse(user) {
  const token = jwt.sign(
    { sub: user._id, role: user.role, studentId: user.student_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const votedElections = (await UserVote.find({ user_id: user._id }).lean()).map(v => v.election_id);

  await AuditLog.create({
    _id: `log-${Date.now()}`,
    action: 'User Login',
    performed_by: user.name,
    role: user.role,
    timestamp: new Date().toISOString(),
    metadata: JSON.stringify({ studentId: user.student_id }),
  });

  return {
    token,
    user: {
      id: user._id,
      studentId: user.student_id,
      name: user.name,
      email: user.email,
      departmentId: user.department_id,
      role: user.role,
      status: user.status,
      hasVoted: votedElections,
    },
  };
}

// POST /api/auth/login — password-based login (admins/auditors)
router.post('/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
      return res.status(400).json({ error: 'Student ID and password are required.' });
    }

    const user = await User.findOne({ student_id: studentId }).lean();
    if (!user) {
      return res.status(401).json({ error: 'Invalid Student ID or password. Please try again.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact administrator.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'This account uses OTP verification. Please use "Sign in with OTP" instead.' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid Student ID or password. Please try again.' });
    }

    const response = await buildAuthResponse(user);
    res.json(response);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/request-otp — send OTP code to voter's phone
router.post('/request-otp', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student/Reference ID is required.' });
    }

    const user = await User.findOne({ student_id: studentId });
    if (!user) {
      return res.status(404).json({ error: 'This Student/Reference ID is not registered. Contact your administrator.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact administrator.' });
    }

    if (!user.phone_number) {
      return res.status(400).json({ error: 'No phone number is linked to this account. Contact your administrator to update your record.' });
    }

    // Generate OTP and set expiry
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.otp_code = otp;
    user.otp_expires = expiresAt;
    await user.save();

    // Mask phone number for response (show last 4 digits)
    const maskedPhone = '****' + user.phone_number.slice(-4);

    // Send SMS
    const message = `UniVote ACSES UMaT\nYour verification code is: ${otp}\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\nDo NOT share this code with anyone.`;
    const sent = await sendSMS(user.phone_number, message);

    if (!sent) {
      console.log('\n┌────────────────────────────────────────────────────────┐');
      console.log('│ ⚠️  SMS GATEWAY BILLING WARNING (Hubtel Account Empty) │');
      console.log(`│   Voter ID:  ${studentId.padEnd(38)} │`);
      console.log(`│   Use OTP:   ${otp.padEnd(38)} │`);
      console.log('│   (Copy & paste this code into the verification input) │');
      console.log('└────────────────────────────────────────────────────────┘\n');
    }

    res.json({
      message: `A verification code has been sent to ${maskedPhone}.`,
      phone: maskedPhone,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err) {
    console.error('Request OTP error:', err);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// POST /api/auth/verify-otp — verify OTP and login
router.post('/verify-otp', async (req, res) => {
  try {
    const { studentId, otp } = req.body;
    if (!studentId || !otp) {
      return res.status(400).json({ error: 'Student ID and verification code are required.' });
    }

    const user = await User.findOne({ student_id: studentId });
    if (!user) {
      return res.status(401).json({ error: 'Invalid Student ID.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact administrator.' });
    }

    if (!user.otp_code || !user.otp_expires) {
      return res.status(400).json({ error: 'No verification code was requested. Please request a new code.' });
    }

    if (new Date() > new Date(user.otp_expires)) {
      // Clear expired OTP
      user.otp_code = null;
      user.otp_expires = null;
      await user.save();
      return res.status(401).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.otp_code !== otp.trim()) {
      return res.status(401).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    // OTP is valid — clear it (one-time use)
    user.otp_code = null;
    user.otp_expires = null;
    await user.save();

    const userObj = user.toObject();
    const response = await buildAuthResponse(userObj);
    res.json(response);
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/refresh — extend session
router.post('/refresh', authenticate, (req, res) => {
  const token = jwt.sign(
    { sub: req.user.id, role: req.user.role, studentId: req.user.student_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  res.json({ token });
});

// GET /api/auth/me — get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const votedElections = (await UserVote.find({ user_id: req.user.id }).lean()).map(v => v.election_id);
    res.json({
      ...req.user,
      studentId: req.user.student_id,
      departmentId: req.user.department_id,
      hasVoted: votedElections,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const valid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid current password. Please try again.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await User.updateOne({ _id: req.user.id }, { password_hash: hash });

    // Log to audit log
    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: 'Password Changed',
      performed_by: user.name,
      role: user.role,
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({ studentId: user.student_id }),
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

