import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { Vote, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'Student Voter',   id: 'UMaT/CSE/21/001', pw: 'voter123', badge: 'voter' },
  { label: 'Administrator',   id: 'UMaT/ADM/001',     pw: 'admin123', badge: 'admin' },
  { label: 'Auditor',         id: 'UMaT/AUD/001',     pw: 'audit123', badge: 'auditor' },
];

const BADGE_STYLE = {
  voter:   { background: 'var(--green-50)',  color: 'var(--green-700)', border: '1px solid var(--green-200)' },
  admin:   { background: 'var(--gold-50)',   color: 'var(--gold-700)',  border: '1px solid var(--gold-100)' },
  auditor: { background: 'var(--gray-100)',  color: 'var(--gray-600)',  border: '1px solid var(--gray-200)' },
};

export default function LoginPage() {
  const { login, requestOtp, loginWithOtp, isLoading, loginError } = useAuth();
  const { addToast } = useElection();
  const [studentId, setStudentId] = useState('');
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);

  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' or 'password'
  const [otpStep, setOtpStep] = useState(1); // 1 = request, 2 = verify
  const [otpCode, setOtpCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!studentId.trim() || !password) return;
    const ok = await login(studentId.trim(), password);
    if (ok) {
      addToast({ type: 'success', title: 'Welcome', message: 'Logged in successfully.' });
    } else {
      addToast({ type: 'error', title: 'Login Failed', message: 'Check your Student ID and password.' });
    }
  };

  const handleRequestOtp = async e => {
    e.preventDefault();
    if (!studentId.trim()) return;
    try {
      const res = await requestOtp(studentId.trim());
      setMaskedPhone(res.phone || 'your registered number');
      setOtpStep(2);
      addToast({ type: 'success', title: 'Verification Sent', message: res.message || 'OTP code sent.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Request Failed', message: err.message || 'Could not send verification code.' });
    }
  };

  const handleVerifyOtp = async e => {
    e.preventDefault();
    if (!studentId.trim() || !otpCode.trim()) return;
    const ok = await loginWithOtp(studentId.trim(), otpCode.trim());
    if (ok) {
      addToast({ type: 'success', title: 'Welcome', message: 'Logged in successfully.' });
    } else {
      addToast({ type: 'error', title: 'Verification Failed', message: 'Invalid or expired code. Please try again.' });
    }
  };

  const useDemo = acct => { 
    setStudentId(acct.id); 
    if (acct.badge === 'voter') {
      setLoginMethod('otp');
      setOtpStep(1);
      setOtpCode('');
    } else {
      setLoginMethod('password');
      setPassword(acct.pw); 
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>

      {/* Top Banner */}
      <div style={{ background: 'var(--green-900)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Vote size={16} color="#1a4a1c" />
          </div>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>UniVote</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>ACSES UMaT E-Voting</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="trust-badge trust-badge-secure">Encrypted</span>
          <span className="trust-badge trust-badge-verified">Auditable</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 860, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 0, background: '#fff', borderRadius: 12, border: '1px solid var(--gray-200)', overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>

          {/* Left — Branding */}
          <div style={{ background: 'var(--green-800)', padding: '44px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <Vote size={26} color="#1a4a1c" />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.5px' }}>UniVote<br/>ACSES UMaT</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                Secure, transparent, and auditable electronic voting for ACSES elections at the University of Mines and Technology, Tarkwa.
              </p>
            </div>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
              {[
                'One vote per registered student',
                'All votes anonymized & encrypted',
                'Real-time tamper-proof audit log',
                'Instant cryptographic receipt',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#1a4a1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              © 2026 ACSES UMaT. University of Mines and Technology, Tarkwa, Ghana.
            </div>
          </div>

          {/* Right — Login Form */}
          <div style={{ padding: '44px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Sign In</h2>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 28 }}>Use your UMaT Student ID to access the voting portal.</p>

            {loginError && (
              <div style={{ display: 'flex', gap: 9, padding: '11px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 7, marginBottom: 18, fontSize: 13, color: 'var(--red-700)', fontWeight: 500 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {loginError}
              </div>
            )}

            {/* Tabs for Login Method */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--gray-200)', paddingBottom: 10 }}>
              <button 
                type="button" 
                onClick={() => { setLoginMethod('otp'); setOtpStep(1); }} 
                style={{ 
                  flex: 1, 
                  background: 'none', 
                  border: 'none', 
                  borderBottom: loginMethod === 'otp' ? '2.5px solid var(--green-700)' : 'none', 
                  color: loginMethod === 'otp' ? 'var(--green-800)' : 'var(--gray-500)', 
                  fontWeight: 700, 
                  padding: '8px 0', 
                  cursor: 'pointer',
                  fontSize: 14,
                  textAlign: 'center',
                  outline: 'none'
                }}
              >
                Voter OTP Sign In
              </button>
              <button 
                type="button" 
                onClick={() => setLoginMethod('password')} 
                style={{ 
                  flex: 1, 
                  background: 'none', 
                  border: 'none', 
                  borderBottom: loginMethod === 'password' ? '2.5px solid var(--green-700)' : 'none', 
                  color: loginMethod === 'password' ? 'var(--green-800)' : 'var(--gray-500)', 
                  fontWeight: 700, 
                  padding: '8px 0', 
                  cursor: 'pointer',
                  fontSize: 14,
                  textAlign: 'center',
                  outline: 'none'
                }}
              >
                Admin / Officer Sign In
              </button>
            </div>

            {loginMethod === 'otp' ? (
              otpStep === 1 ? (
                <form onSubmit={handleRequestOtp}>
                  <div style={{ marginBottom: 18 }}>
                    <label className="form-label">Student ID / Reference Number</label>
                    <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)}
                      className="form-input form-input-mono"
                      placeholder="UMaT/CSE/21/001"
                      autoComplete="username" required />
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6, lineHeight: 1.4 }}>
                      A verification code will be sent to your registered mobile number via Hubtel SMS.
                    </p>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                    {isLoading ? <><Loader2 size={15} className="animate-spin" /> Sending Code...</> : 'Send Code →'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Student ID</label>
                    <input type="text" value={studentId} disabled
                      className="form-input form-input-mono"
                      style={{ background: 'var(--gray-50)', color: 'var(--gray-500)' }} />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label className="form-label">Enter Verification Code</label>
                    <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)}
                      className="form-input form-input-mono"
                      placeholder="••••••"
                      style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: 18, fontWeight: 700 }}
                      maxLength={6} required />
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6, lineHeight: 1.4 }}>
                      Enter the 6-digit code sent to <strong>{maskedPhone}</strong>.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setOtpStep(1)}>
                      Back
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={isLoading}>
                      {isLoading ? <><Loader2 size={15} className="animate-spin" /> Verifying...</> : 'Verify & Sign In'}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Officer ID</label>
                  <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)}
                    className="form-input form-input-mono"
                    placeholder="UMaT/ADM/001"
                    autoComplete="username" required />
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      className="form-input"
                      placeholder="Enter your password"
                      autoComplete="current-password" required />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                  {isLoading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : 'Sign In →'}
                </button>
              </form>
            )}

            {/* Demo Accounts */}
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--gray-100)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Demo Accounts — Quick Access</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {DEMO_ACCOUNTS.map(a => (
                  <button key={a.badge} onClick={() => useDemo(a)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', border: '1px solid var(--gray-200)', borderRadius: 7, background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green-300)'; e.currentTarget.style.background = 'var(--green-50)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.background = '#fff'; }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize', ...BADGE_STYLE[a.badge] }}>{a.badge}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{a.label}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', marginTop: 1 }}>{a.id}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Use →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
