// ============================================
// AUTH ROUTES — Login, OTP, Register, Session
// ============================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserVote from '../models/UserVote.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate } from '../middleware/auth.js';
import { sendSMS, generateOTP } from '../utils/sms.js';
import { sendOTPEmail } from '../utils/email.js';
import { rateLimit } from 'express-rate-limit';
import BlacklistedToken from '../models/BlacklistedToken.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const OTP_EXPIRY_MINUTES = 30;

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => req.body.studentId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
});

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests. Please try again after 15 minutes.' },
  keyGenerator: (req) => req.body.studentId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP verification attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => req.body.studentId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
});

// Helper: build token + user response
async function buildAuthResponse(user) {
  const token = jwt.sign(
    { sub: user._id, role: user.role, studentId: user.student_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const votedElections = (await UserVote.find({ user_id: user._id }).lean()).map(v => v.election_id);

  const hashedStudentId = crypto.createHash('sha256').update(user.student_id).digest('hex');
  await AuditLog.create({
    _id: `log-${Date.now()}`,
    action: 'User Login',
    performed_by: user.name,
    role: user.role,
    timestamp: new Date().toISOString(),
    metadata: JSON.stringify({ studentIdHash: hashedStudentId }),
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
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
      return res.status(400).json({ error: 'Student ID and password are required.' });
    }

    const user = await User.findOne({ student_id: studentId }).lean();

    if (!user || user.status === 'suspended') {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Authentication method not configured.' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }

    const response = await buildAuthResponse(user);
    res.json(response);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/request-otp — send OTP code to voter's phone
router.post('/request-otp', otpRequestLimiter, async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student/Reference ID is required.' });
    }

    const user = await User.findOne({ student_id: studentId });

    const genericResponse = {
      message: 'If this account exists and is active, a verification code has been sent.',
      phone: 'your registered number',
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    };

    if (!user) {
      return res.status(404).json({ error: 'Voter record not found. Please verify your Student/Reference ID.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Voter account is suspended. Please contact the administrator.' });
    }

    if (!user.phone_number) {
      return res.status(400).json({ error: 'No registered telephone number found for this voter.' });
    }

    const phoneList = user.phone_number.split(/[,\/]+/).map(p => p.trim()).filter(Boolean);
    let targetPhone = null;

    if (phoneList.length > 1) {
      const { selectedPhoneIndex } = req.body;
      if (selectedPhoneIndex === undefined || selectedPhoneIndex === null) {
        const masked = phoneList.map((p, idx) => {
          const clean = p.replace(/\D/g, '');
          const lastFour = clean.slice(-4);
          return {
            index: idx,
            masked: '*'.repeat(Math.max(0, clean.length - 4)) + lastFour
          };
        });
        return res.json({
          requirePhoneSelection: true,
          phones: masked
        });
      }
      const idxNum = parseInt(selectedPhoneIndex, 10);
      if (isNaN(idxNum) || idxNum < 0 || idxNum >= phoneList.length) {
        return res.status(400).json({ error: 'Invalid selected phone number index.' });
      }
      targetPhone = phoneList[idxNum];
    } else {
      targetPhone = phoneList[0];
    }

    // 1. Enforce the limit of 2 SMS codes per reference number
    if ((user.otp_count || 0) >= 2) {
      return res.status(400).json({ error: 'You have reached the maximum limit of 2 verification codes. Please contact the administrator.' });
    }

    // 2. Enforce the 30-minute cooldown (coinciding with the code's active period expiry)
    if (user.otp_expires && new Date() < new Date(user.otp_expires)) {
      return res.status(429).json({ error: 'A verification code is already active. You can only request another code after 30 minutes.' });
    }

    // Generate OTP and set expiry
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const hashedOtp = bcrypt.hashSync(otp, 10);
    user.otp_code = hashedOtp;
    user.otp_expires = expiresAt;
    user.otp_count = (user.otp_count || 0) + 1;
    await user.save();

    // Send SMS (primary channel)
    const message = `UniVote ACSES UMaT\nYour verification code is: ${otp}\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\nDo NOT share this code with anyone.`;
    const smsSent = await sendSMS(targetPhone, message);

    // If SMS fails, attempt email delivery as secondary channel
    if (!smsSent) {
      console.warn(`⚠️  SMS delivery failed for ${studentId} — attempting email fallback...`);
      const emailSent = await sendOTPEmail(user.email, otp, studentId);

      if (!emailSent) {
        // Both channels failed — log securely without exposing OTP
        console.error(`❌ Both SMS and email delivery failed for voter ${studentId}. OTP generated but undeliverable.`);


        // Audit log the delivery failure
        await AuditLog.create({
          _id: `log-${Date.now()}`,
          action: 'OTP Delivery Failed',
          performed_by: 'System',
          role: 'System',
          timestamp: new Date().toISOString(),
          metadata: JSON.stringify({
            studentIdHash: crypto.createHash('sha256').update(studentId).digest('hex'),
            smsStatus: 'failed',
            emailStatus: 'failed',
            reason: 'Both SMS gateway and SMTP relay unavailable'
          })
        }).catch(() => { });
      } else {
        // Email succeeded — update response to hint at email delivery
        genericResponse.message = 'If this account exists and is active, a verification code has been sent to your registered email.';
        genericResponse.phone = 'your registered email';
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Request OTP error:', err);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// POST /api/auth/verify-otp — verify OTP and login
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
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

    const isValidOtp = bcrypt.compareSync(otp.trim(), user.otp_code);
    if (!isValidOtp) {
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

// POST /api/auth/refresh — extend session with token rotation
router.post('/refresh', authenticate, async (req, res) => {
  try {
    // Rotation: Blacklist the old token
    if (req.tokenString && req.token && req.token.exp) {
      await BlacklistedToken.create({
        token: req.tokenString,
        expires_at: new Date(req.token.exp * 1000),
      }).catch(err => console.error('Token blacklist logging error:', err));
    }

    const token = jwt.sign(
      { sub: req.user.id, role: req.user.role, studentId: req.user.student_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ token });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/logout — revoke session token
router.post('/logout', authenticate, async (req, res) => {
  try {
    if (req.tokenString && req.token && req.token.exp) {
      await BlacklistedToken.create({
        token: req.tokenString,
        expires_at: new Date(req.token.exp * 1000),
      });
    }
    res.json({ message: 'Successfully logged out.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
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

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Password authentication is not active for this account (OTP login style).' });
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

// POST /api/auth/agent/login — authenticate a polling agent with a passcode
router.post('/agent/login', async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'Agent passcode is required.' });
    }

    const expectedPasscode = process.env.AGENT_PASSCODE || 'agent123';
    if (passcode !== expectedPasscode) {
      return res.status(401).json({ error: 'Invalid agent passcode.' });
    }

    // Sign a token for agent role
    const token = jwt.sign(
      { sub: 'polling-agent', role: 'agent', name: 'Polling Agent' },
      JWT_SECRET,
      { expiresIn: '8h' } // Polling agent sessions expire in 8 hours
    );

    res.json({
      token,
      user: {
        id: 'polling-agent',
        studentId: 'AGENT-SESSION',
        name: 'Polling Agent',
        email: 'agent@univote.acses-srid.com',
        role: 'agent',
        status: 'active',
      }
    });

    // Log to Audit Log
    await AuditLog.create({
      _id: `log-${Date.now()}`,
      action: 'Agent Session Initiated',
      performed_by: 'Polling Agent',
      role: 'Agent',
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({}),
    });
  } catch (err) {
    console.error('Agent login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

