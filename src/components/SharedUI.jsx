import { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X, AlertOctagon, Loader2, Shield, Lock } from 'lucide-react';
import { getSyncedDate } from '../utils/time';

/* ── TOAST CONTAINER ── */
export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-wrapper">
      {toasts.map(t => <Toast key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}
function Toast({ toast, onRemove }) {
  const icons = {
    success: <CheckCircle size={16} style={{ color: 'var(--green-500)', flexShrink: 0 }} />,
    error: <AlertOctagon size={16} style={{ color: 'var(--red-500)', flexShrink: 0 }} />,
    warning: <AlertTriangle size={16} style={{ color: 'var(--gold-500)', flexShrink: 0 }} />,
    info: <Info size={16} style={{ color: 'var(--green-400)', flexShrink: 0 }} />,
  };
  return (
    <div className={`toast toast-${toast.type || 'info'}`} role="alert">
      <span style={{ marginTop: 1 }}>{icons[toast.type] || icons.info}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-900)', marginBottom: 1 }}>{toast.title}</p>}
        <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>{toast.message}</p>
      </div>
      <button onClick={() => onRemove(toast.id)} style={{ color: 'var(--gray-400)', cursor: 'pointer', background: 'none', border: 'none', padding: 2, flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ── CONFIRM MODAL ── */
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isOpen) { ref.current?.focus(); document.body.style.overflow = 'hidden'; }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-box" ref={ref} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <h3 id="modal-title" style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>{title}</h3>
        {message && <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 14 }}>{message}</p>}
        {children}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} style={{ flex: 1 }} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

/* ── SESSION WARNING ── */
export function SessionWarningModal({ isOpen, onExtend, onLogout }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 9100 }}>
      <div className="modal-box animate-scale-in" style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--gold-50)', border: '1px solid var(--gold-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <AlertTriangle size={26} style={{ color: 'var(--gold-500)' }} />
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>Session Expiring</h3>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 20 }}>Your session will expire in 2 minutes due to inactivity.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onLogout}>Log Out</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onExtend}>Stay Logged In</button>
        </div>
      </div>
    </div>
  );
}

/* ── LOADING SPINNER ── */
export function LoadingSpinner({ size = 'md', text }) {
  const px = { sm: 18, md: 28, lg: 44 }[size];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 0' }}>
      <Loader2 size={px} style={{ color: 'var(--green-500)' }} className="animate-spin" />
      {text && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{text}</p>}
    </div>
  );
}

/* ── STAT CARD ── */
const STAT_BG = {
  green: { icon: 'var(--green-500)', bg: 'var(--green-50)', border: 'var(--green-100)' },
  gold: { icon: 'var(--gold-500)', bg: 'var(--gold-50)', border: 'var(--gold-100)' },
  red: { icon: 'var(--red-500)', bg: 'var(--red-50)', border: 'var(--red-100)' },
  gray: { icon: 'var(--gray-500)', bg: 'var(--gray-100)', border: 'var(--gray-200)' },
  accent: { icon: 'var(--green-600)', bg: 'var(--green-50)', border: 'var(--green-100)' },
  // keep old names mapping
  emerald: { icon: 'var(--green-500)', bg: 'var(--green-50)', border: 'var(--green-100)' },
  amber: { icon: 'var(--gold-500)', bg: 'var(--gold-50)', border: 'var(--gold-100)' },
  purple: { icon: 'var(--green-600)', bg: 'var(--green-50)', border: 'var(--green-100)' },
};
export function StatCard({ icon: Icon, label, value, trend, color = 'green' }) {
  const c = STAT_BG[color] || STAT_BG.green;
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} style={{ color: c.icon }} />
        </div>
        {trend !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
            background: trend >= 0 ? 'var(--green-50)' : 'var(--red-50)',
            color: trend >= 0 ? 'var(--green-700)' : 'var(--red-600)',
            border: `1px solid ${trend >= 0 ? 'var(--green-100)' : 'var(--red-100)'}`
          }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)', lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 3, fontWeight: 500 }}>{label}</p>
    </div>
  );
}

/* ── STATUS BADGE ── */
export function StatusBadge({ status }) {
  return (
    <span className={`badge-${status || 'draft'}`}>
      ● {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'}
    </span>
  );
}

/* ── EMPTY STATE ── */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 16px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon size={30} style={{ color: 'var(--gray-300)' }} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--gray-400)', maxWidth: 300, marginBottom: 20, lineHeight: 1.6 }}>{description}</p>
      {actionLabel && onAction && <button className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

/* ── TRUST BADGE ── */
export function TrustBadge({ type = 'secure' }) {
  const cfg = {
    secure: { icon: Lock, text: 'Encrypted', cls: 'trust-badge-secure' },
    verified: { icon: Shield, text: 'Auditable', cls: 'trust-badge-verified' },
    locked: { icon: Lock, text: 'Results Locked', cls: 'trust-badge-locked' },
  };
  const { icon: Icon, text, cls } = cfg[type] || cfg.secure;
  return <span className={`trust-badge ${cls}`}><Icon size={11} /> {text}</span>;
}

/* ── COUNTDOWN TIMER ── */
export function CountdownTimer({ endTime }) {
  const calc = () => {
    const d = new Date(endTime) - getSyncedDate();
    if (d <= 0) return { expired: true };
    return { days: Math.floor(d / 86400000), hours: Math.floor((d / 3600000) % 24), minutes: Math.floor((d / 60000) % 60), seconds: Math.floor((d / 1000) % 60), expired: false };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, [endTime]);
  if (t.expired) return <span style={{ color: 'var(--red-600)', fontWeight: 700, fontSize: 12 }}>Closed</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {[{ v: t.days, l: 'd' }, { v: t.hours, l: 'h' }, { v: t.minutes, l: 'm' }, { v: t.seconds, l: 's' }].map(({ v, l }) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span className="countdown-segment">{String(v).padStart(2, '0')}</span>
          <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

/* ── SEARCH INPUT ── */
export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div style={{ position: 'relative' }}>
      <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="form-input" style={{ paddingLeft: 33 }} />
    </div>
  );
}

/* ── CONFETTI ── */
export function Confetti() {
  const colors = ['#2e7d32', '#f59e0b', '#ffffff', '#43a047', '#fbbf24', '#1a4a1c'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 2,
    color: colors[i % colors.length], size: Math.random() * 8 + 4,
    rotate: Math.random() * 360, round: Math.random() > 0.5,
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, top: 0, width: p.size, height: p.size,
          backgroundColor: p.color, borderRadius: p.round ? '50%' : 2,
          transform: `rotate(${p.rotate}deg)`, animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}
