import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { Vote, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import acsesLogo from '../ACSES.jpg';

export default function LoginPage() {
  const { login, requestOtp, loginWithOtp, isLoading, loginError } = useAuth();
  const { addToast } = useElection();
  const [studentId, setStudentId] = useState(() => sessionStorage.getItem('login_studentId') || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [loginMethod, setLoginMethod] = useState(() => sessionStorage.getItem('login_method') || 'otp'); // 'otp' or 'password'
  const [otpStep, setOtpStep] = useState(() => parseInt(sessionStorage.getItem('login_otpStep') || '1', 10)); // 1 = request, 2 = verify
  const [otpCode, setOtpCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState(() => sessionStorage.getItem('login_maskedPhone') || '');

  useEffect(() => { sessionStorage.setItem('login_studentId', studentId); }, [studentId]);
  useEffect(() => { sessionStorage.setItem('login_method', loginMethod); }, [loginMethod]);
  useEffect(() => { sessionStorage.setItem('login_otpStep', otpStep.toString()); }, [otpStep]);
  useEffect(() => { sessionStorage.setItem('login_maskedPhone', maskedPhone); }, [maskedPhone]);

  const [phoneOptions, setPhoneOptions] = useState([]);
  const [selectedMobileIndex, setSelectedMobileIndex] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!studentId.trim() || !password) return;
    const ok = await login(studentId.trim(), password);
    if (ok) {
      sessionStorage.removeItem('login_studentId');
      sessionStorage.removeItem('login_method');
      sessionStorage.removeItem('login_otpStep');
      sessionStorage.removeItem('login_maskedPhone');
      addToast({ type: 'success', title: 'Welcome', message: 'Logged in successfully.' });
    } else {
      addToast({ type: 'error', title: 'Login Failed', message: 'Check your Student ID and password.' });
    }
  };

  const handleRequestOtp = async (e, selIdx = null) => {
    if (e) e.preventDefault();
    if (!studentId.trim()) return;
    try {
      const res = await requestOtp(studentId.trim(), selIdx);
      if (res.requirePhoneSelection) {
        setPhoneOptions(res.phones);
        setSelectedMobileIndex(res.phones[0].index.toString());
        addToast({ type: 'info', title: 'Multiple Numbers', message: 'Select registered mobile list item to receive your OTP.' });
      } else {
        setMaskedPhone(res.phone || 'your registered number');
        setOtpStep(2);
        setPhoneOptions([]);
        addToast({ type: 'success', title: 'Verification Sent', message: res.message || 'OTP code sent.' });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Request Failed', message: err.message || 'Could not send verification code.' });
    }
  };

  const handleVerifyOtp = async e => {
    e.preventDefault();
    if (!studentId.trim() || !otpCode.trim()) return;
    const ok = await loginWithOtp(studentId.trim(), otpCode.trim());
    if (ok) {
      sessionStorage.removeItem('login_studentId');
      sessionStorage.removeItem('login_method');
      sessionStorage.removeItem('login_otpStep');
      sessionStorage.removeItem('login_maskedPhone');
      addToast({ type: 'success', title: 'Welcome', message: 'Logged in successfully.' });
    } else {
      addToast({ type: 'error', title: 'Verification Failed', message: 'Invalid or expired code. Please try again.' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>

      {/* Top Banner */}
      <div className="login-header-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={acsesLogo} alt="ACSES Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>UniVote</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, display: 'inline-block' }}>ACSES-SRID eVoting</span>
        </div>
        <div className="trust-badges-wrapper" style={{ display: 'flex', gap: 6 }}>
          <span className="trust-badge trust-badge-secure">Encrypted</span>
          <span className="trust-badge trust-badge-verified">Auditable</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="login-card-container">

          {/* Left — Branding Panel (Desktop Only) */}
          <div className="login-branding-panel">
            <div>
              <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <img src={acsesLogo} alt="ACSES Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.5px' }}>UniVote<br />ACSES-SRID eVoting</h1>
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
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#1a4a1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              © 2026 ACSES-SRID eVoting.
            </div>
          </div>

          {/* Right — Login Form Panel */}
          <div className="login-form-panel">

            {/* Mobile Header (active when branding panel is hidden) */}
            <div className="login-mobile-header">
              <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: '1.5px solid var(--green-100)' }}>
                <img src={acsesLogo} alt="ACSES Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--green-900)', margin: 0, letterSpacing: '-0.5px' }}>UniVote</h1>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '4px 0 0 0' }}>ACSES-SRID eVoting System</p>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Sign In</h2>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 24 }}>Use your UMaT Student ID to access the voting portal.</p>

            {loginError && (
              <div style={{ display: 'flex', gap: 9, padding: '11px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 7, marginBottom: 18, fontSize: 13, color: 'var(--red-700)', fontWeight: 500 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {loginError}
              </div>
            )}

            {/* Tabs for Login Method */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => { setLoginMethod('otp'); setOtpStep(1); }}
                className={`login-tab-btn ${loginMethod === 'otp' ? 'active' : ''}`}
              >
                Voter OTP Sign In
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('password')}
                className={`login-tab-btn ${loginMethod === 'password' ? 'active' : ''}`}
              >
                Officer Sign In
              </button>
            </div>

            {loginMethod === 'otp' ? (
              otpStep === 1 ? (
                phoneOptions.length > 0 ? (
                  <form onSubmit={(e) => handleRequestOtp(e, parseInt(selectedMobileIndex, 10))}>
                    <div style={{ marginBottom: 18 }}>
                      <label className="form-label" style={{ fontWeight: 700 }}>Select Delivery Phone Number</label>
                      <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.4 }}>
                        Multiple registered phone contacts detected. Select the number to receive the authentication code:
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {phoneOptions.map((p) => (
                          <label key={p.index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 14px',
                            border: `1.5px solid ${selectedMobileIndex === p.index.toString() ? 'var(--green-500)' : 'var(--border)'}`,
                            background: selectedMobileIndex === p.index.toString() ? 'var(--green-50)' : 'transparent',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}>
                            <input
                              type="radio"
                              name="selectedPhone"
                              value={p.index}
                              checked={selectedMobileIndex === p.index.toString()}
                              onChange={() => setSelectedMobileIndex(p.index.toString())}
                              style={{ accentColor: 'var(--green-600)', width: 16, height: 16 }}
                            />
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>SMS Channel {p.index + 1}</span>
                              <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>{p.masked}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPhoneOptions([])}>
                        Back
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={isLoading}>
                        {isLoading ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : 'Send OTP Code →'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRequestOtp}>
                    <div style={{ marginBottom: 18 }}>
                      <label className="form-label">Student ID / Reference Number</label>
                      <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)}
                        className="form-input form-input-mono"
                        placeholder="9012XXXXXXX"
                        autoComplete="username" required />
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6, lineHeight: 1.4 }}>
                        A verification code will be sent to your registered mobile number.
                      </p>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                      {isLoading ? <><Loader2 size={15} className="animate-spin" /> Sending Code...</> : 'Send Code →'}
                    </button>
                  </form>
                )
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
          </div>
        </div>
      </div>
    </div>
  );
}
