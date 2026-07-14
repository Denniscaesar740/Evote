import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import api from '../services/api';
import {
  User, Mail, ShieldCheck, Vote, CheckCircle, Lock, Bell,
  Eye, LogOut, Save, Key, ToggleLeft, ToggleRight, Building2
} from 'lucide-react';
import { StatusBadge } from '../components/SharedUI';

const ROLE_GRAD = {
  voter:   'linear-gradient(135deg,var(--accent-500),var(--accent-600))',
  admin:   'linear-gradient(135deg,var(--purple-600),#6d28d9)',
  auditor: 'linear-gradient(135deg,var(--emerald-500),var(--emerald-600))',
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { elections, departments } = useElection();

  const [tab, setTab]                 = useState('overview');
  const [notif, setNotif]             = useState({ email: true, browser: false, results: true, warnings: true });
  const [saved, setSaved]             = useState(false);
  const [pwForm, setPwForm]           = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]             = useState('');
  const [showCurrent, setShowCurrent] = useState(false);

  const dept         = departments.find(d => d.id === user?.departmentId);
  const votedElecs   = elections.filter(e => user?.hasVoted?.includes(e.id));
  const eligibleElecs = elections.filter(e => e.status !== 'draft' && (!e.departmentId || e.departmentId === user?.departmentId));
  const roleLabels   = { voter: 'Student Voter', admin: 'System Administrator', auditor: 'Independent Auditor' };

  const saveNotif = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const changePassword = async () => {
    if (!pwForm.current) { setPwMsg('error:Enter current password.'); return; }
    if (pwForm.next.length < 6) { setPwMsg('error:New password must be ≥ 6 characters.'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg('error:Passwords do not match.'); return; }
    
    try {
      await api.changePassword(pwForm.current, pwForm.next);
      setPwMsg('success:Password updated successfully.'); 
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg(`error:${err.message || 'Failed to update password.'}`);
    }
  };

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'activity',  label: 'Vote Activity' },
    { id: 'notif',     label: 'Notifications' },
    { id: 'security',  label: 'Security' },
  ];

  const s = (label, value, type = 'text', show = false, onShow) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={type === 'password' && show ? 'text' : type} value={value}
          onChange={e => setPwForm(p => ({ ...p, [label === 'Current Password' ? 'current' : label === 'New Password' ? 'next' : 'confirm']: e.target.value }))}
          className="form-input" />
        {type === 'password' && <button onClick={onShow} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-400)' }}><Eye size={15} /></button>}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }} className="animate-fade-in">
      {/* Profile Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-950), var(--navy-800))', borderRadius: 20, padding: '32px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: ROLE_GRAD[user?.role], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', flexShrink: 0 }}>
          {user?.name?.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-0.3px' }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{roleLabels[user?.role]} · {dept?.name || 'Department of Computing and Data Analytics'}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{user?.studentId}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 18px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{votedElecs.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Votes Cast</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 18px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{eligibleElecs.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Eligible</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {TABS.map(t => <button key={t.id} className={`tab-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-padded">
            <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 18 }}>Account Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
              {[
                { icon: User,     label: 'Full Name',   value: user?.name },
                { icon: Mail,     label: 'Email',       value: user?.email },
                { icon: Key,      label: 'Student ID',  value: user?.studentId,  mono: true },
                { icon: Building2, label: 'Department', value: dept?.name || 'Department of Computing and Data Analytics' },
                { icon: ShieldCheck, label: 'Role',    value: roleLabels[user?.role] },
                { icon: Lock,     label: 'Auth Method', value: 'Institutional SSO' },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--navy-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} style={{ color: 'var(--navy-400)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-800)', marginTop: 2, fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-padded" style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--red-600)', marginBottom: 12 }}>Danger Zone</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--red-500)' }}>Once you log out, you will need your credentials to re-enter the system.</p>
              <button className="btn btn-danger btn-sm" onClick={logout}><LogOut size={14} />Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VOTE ACTIVITY ── */}
      {tab === 'activity' && (
        <div className="card card-padded">
          <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 18 }}>Vote History</h3>
          {votedElecs.length === 0
            ? <p style={{ color: 'var(--navy-400)', fontSize: 14 }}>No votes cast yet. Participate in an active election from your dashboard.</p>
            : votedElecs.map(el => (
              <div key={el.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--navy-50)', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--emerald-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={18} style={{ color: 'var(--emerald-500)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-900)' }}>{el.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 2 }}>{el.type}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge status={el.status} />
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--navy-400)' }}>{new Date(el.endTime).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'notif' && (
        <div className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 18 }}>Notification Preferences</h3>
          {[
            { key: 'email',    label: 'Email Notifications', desc: 'Receive election reminders and results via university email.' },
            { key: 'browser',  label: 'Browser Push Alerts',  desc: 'Real-time push notifications in your browser.' },
            { key: 'results',  label: 'Results Announcements', desc: 'Be notified when election results are published.' },
            { key: 'warnings', label: 'Security Alerts',      desc: 'Receive alerts for suspicious login attempts.' },
          ].map(n => (
            <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--navy-50)', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-800)' }}>{n.label}</div>
                <div style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 3 }}>{n.desc}</div>
              </div>
              <button onClick={() => setNotif(p => ({ ...p, [n.key]: !p[n.key] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                {notif[n.key]
                  ? <ToggleRight size={28} style={{ color: 'var(--accent-500)' }} />
                  : <ToggleLeft  size={28} style={{ color: 'var(--navy-200)' }} />
                }
              </button>
            </div>
          ))}
          <div style={{ paddingTop: 18 }}>
            <button className="btn btn-primary btn-sm" onClick={saveNotif}>
              {saved ? <><CheckCircle size={14} />Saved!</> : <><Save size={14} />Save Preferences</>}
            </button>
          </div>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-padded">
            <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 4 }}>Change Password</h3>
            <p style={{ fontSize: 13, color: 'var(--navy-400)', marginBottom: 18 }}>Use a strong password with at least 8 characters, including numbers and symbols.</p>
            {s('Current Password', pwForm.current, 'password', showCurrent, () => setShowCurrent(v => !v))}
            {s('New Password',     pwForm.next,    'password')}
            {s('Confirm Password', pwForm.confirm, 'password')}
            {pwMsg && (
              <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 12, background: pwMsg.startsWith('error') ? 'var(--red-50)' : 'var(--emerald-50)', border: `1px solid ${pwMsg.startsWith('error') ? 'var(--red-100)' : 'rgba(16,185,129,0.2)'}`, fontSize: 13, color: pwMsg.startsWith('error') ? 'var(--red-600)' : 'var(--emerald-600)', fontWeight: 600 }}>
                {pwMsg.split(':')[1]}
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={changePassword}><Lock size={14} />Update Password</button>
          </div>

          <div className="card card-padded">
            <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 14 }}>Active Sessions</h3>
            {[
              { device: 'Chrome on Windows 11', location: 'Accra, GH', time: 'Now (current)', current: true },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--navy-50)', borderRadius: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-800)' }}>{s.device}</div>
                  <div style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 2 }}>{s.location} · {s.time}</div>
                </div>
                {s.current ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald-600)', background: 'var(--emerald-100)', padding: '3px 9px', borderRadius: 99 }}>Current</span>
                  : <button className="btn btn-danger btn-sm">Revoke</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
