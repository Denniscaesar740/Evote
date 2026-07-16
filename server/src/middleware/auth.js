// ============================================
// AUTH MIDDLEWARE — JWT verification & role gates
// ============================================
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import BlacklistedToken from '../models/BlacklistedToken.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

/**
 * Verifies JWT token and attaches user to req.user
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
  }

  const token = header.split(' ')[1];
  try {
    const isBlacklisted = await BlacklistedToken.findOne({ token }).lean();
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    let user;
    if (decoded.sub === 'polling-agent') {
      user = {
        _id: 'polling-agent',
        student_id: 'AGENT-SESSION',
        name: 'Polling Agent',
        email: 'agent@univote.acses-srid.com',
        role: 'agent',
        status: 'active',
      };
    } else {
      user = await User.findById(decoded.sub).select('student_id name email department_id role status').lean();
    }
    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Contact administrator.' });

    // Normalize _id to id for downstream compatibility
    user.id = user._id;
    req.user = user;
    req.token = decoded;
    req.tokenString = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Role-based access control
 * @param  {...string} roles - Allowed roles
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` });
    }
    next();
  };
}
