import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Vote, LayoutDashboard, Users, BarChart3, LogOut, Menu, X,
  ChevronDown, Bell, FileText, ClipboardList, UserCheck,
  PieChart, Eye, Building2, User, Settings, Calendar, UserPlus
} from 'lucide-react';

const roleNavItems = {
  voter: [
    { id: 'dashboard',   label: 'My Elections', icon: Vote },
    { id: 'results',     label: 'Results',       icon: BarChart3 },
  ],
  admin: [
    { id: 'dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
    { id: 'elections',   label: 'Elections',      icon: ClipboardList },
    { id: 'candidates',  label: 'Candidates',     icon: Users },
    { id: 'voters',      label: 'Voter Registry', icon: UserCheck },
    { id: 'departments', label: 'Departments',    icon: Building2 },
    { id: 'users',       label: 'User Mgmt',      icon: UserPlus },
    { id: 'notices',     label: 'Notice Board',   icon: Bell },
    { id: 'calendar',    label: 'Schedule',       icon: Calendar },
    { id: 'config',      label: 'Settings',       icon: Settings },
    { id: 'results',     label: 'Results',        icon: PieChart },
    { id: 'audit',       label: 'Audit Log',      icon: FileText },
  ],
  auditor: [
    { id: 'dashboard',   label: 'Overview',       icon: Eye },
    { id: 'elections',   label: 'Elections',      icon: ClipboardList },
    { id: 'audit',       label: 'Audit Trail',    icon: FileText },
    { id: 'results',     label: 'Results',        icon: BarChart3 },
    { id: 'departments', label: 'Departments',    icon: Building2 },
  ],
};

const roleLabels = {
  voter:   'Student Voter',
  admin:   'Administrator',
  auditor: 'Auditor',
};

const NOTIFS = [
  { id: 1, text: 'ACSES Executive Election: 197 votes cast so far.',     time: '5m ago',  read: false },
  { id: 2, text: 'Off-hours access attempt detected and logged.',         time: '2h ago',  read: false },
  { id: 3, text: 'CSE Level 300 Class Rep results have been locked.',     time: '3d ago',  read: true },
  { id: 4, text: 'Mining Engineering SRC election draft created.',        time: '4d ago',  read: true },
];

export default function AppLayout({ currentPage, onNavigate, children }) {
  const { user, logout, switchRole } = useAuth();
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [roleOpen,    setRoleOpen]    = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [notifs,      setNotifs]      = useState(NOTIFS);

  const navItems = roleNavItems[user?.role] || roleNavItems.voter;
  const unread   = notifs.filter(n => !n.read).length;
  const roleLabel = roleLabels[user?.role] || 'Voter';

  const markRead = id => setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  const markAll  = ()  => setNotifs(p => p.map(n => ({ ...n, read: true })));

  const SidebarContent = ({ onClose }) => (
    <>
      {/* Branding */}
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Vote size={18} color="#1a4a1c" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', lineHeight: 1.2 }}>UniVote</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.2 }}>ACSES UMaT</div>
            </div>
          </div>
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={17} /></button>}
        </div>
        {/* Role chip */}
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, border: '1px solid rgba(255,255,255,0.08)', display: 'inline-block' }}>
          {roleLabel}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const isActive = currentPage === item.id;
          return (
            <button key={item.id} className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => { onNavigate(item.id); onClose?.(); }}>
              <item.icon size={15} style={{ flexShrink: 0, color: isActive ? 'var(--gold-400)' : 'rgba(255,255,255,0.38)' }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile link */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
          onClick={() => { onNavigate('profile'); onClose?.(); }}>
          <User size={15} style={{ flexShrink: 0, color: currentPage === 'profile' ? 'var(--gold-400)' : 'rgba(255,255,255,0.38)' }} />
          My Profile
        </button>
      </div>

      {/* User card */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--green-700)', border: '1px solid var(--green-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
          {user?.name?.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.studentId}</div>
        </div>
        <button onClick={logout} title="Sign out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
          <LogOut size={14} />
        </button>
      </div>
    </>
  );

  return (
    <div className="page-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar"><SidebarContent /></aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
          <aside className="animate-slide-in-left sidebar" style={{ position: 'absolute', display: 'flex' }}>
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Notifications panel */}
      {notifOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 45 }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={() => setNotifOpen(false)} />
          <div className="animate-slide-in-right" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, background: '#fff', boxShadow: '-2px 0 20px rgba(0,0,0,0.1)', borderLeft: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>Notifications</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{unread} unread</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
                <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 3 }}><X size={17} /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifs.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)} style={{ display: 'flex', gap: 10, padding: '13px 18px', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--green-50)', borderBottom: '1px solid var(--gray-100)', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'var(--green-50)'}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? 'var(--gray-300)' : 'var(--green-500)', flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--gray-800)', fontWeight: n.read ? 400 : 600, lineHeight: 1.5 }}>{n.text}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="main-content">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}
              style={{ display: 'none', padding: 7, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-600)' }}>
              <Menu size={20} />
            </button>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>
                {[...navItems, { id: 'profile', label: 'My Profile' }].find(i => i.id === currentPage)?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Role switcher */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setRoleOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 6, border: '1px solid var(--gray-300)', background: rOle(user?.role), fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', cursor: 'pointer', textTransform: 'capitalize' }}>
                {user?.role} <ChevronDown size={12} style={{ color: 'var(--gray-400)' }} />
              </button>
              {roleOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setRoleOpen(false)} />
                  <div className="animate-scale-in" style={{ position: 'absolute', right: 0, top: 'calc(100% + 5px)', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', padding: 5, minWidth: 170, zIndex: 50 }}>
                    <p style={{ padding: '5px 9px', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Demo — Switch Role</p>
                    {['voter','admin','auditor'].map(role => (
                      <button key={role} onClick={() => { switchRole(role); onNavigate('dashboard'); setRoleOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 9px', borderRadius: 6, background: user?.role === role ? 'var(--green-50)' : 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: user?.role === role ? 700 : 400, color: user?.role === role ? 'var(--green-700)' : 'var(--gray-700)', textAlign: 'left', textTransform: 'capitalize' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: user?.role === role ? 'var(--green-500)' : 'var(--gray-300)' }} />
                        {role}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bell */}
            <button onClick={() => setNotifOpen(v => !v)} style={{ position: 'relative', padding: 7, borderRadius: 6, background: notifOpen ? 'var(--gray-100)' : 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}>
              <Bell size={18} />
              {unread > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--red-500)', border: '1.5px solid #fff' }} />}
            </button>

            {/* Avatar */}
            <button onClick={() => onNavigate('profile')} style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--green-700)', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user?.name?.charAt(0)}
            </button>
          </div>
        </header>

        <main style={{ padding: '24px 28px', flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function rOle(role) {
  if (role === 'admin')   return 'var(--green-50)';
  if (role === 'auditor') return 'var(--gold-50)';
  return '#fff';
}
