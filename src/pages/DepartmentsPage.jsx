import { useState } from 'react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { Building2, Users, Vote, BarChart3, Plus, Edit2, Check, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DEPT_COLORS = ['var(--green-600)', 'var(--gold-500)', 'var(--green-700)', 'var(--gold-600)'];

const FACULTY_GRAD = {
  'Faculty of Computing & IT': 'linear-gradient(135deg,var(--green-600),var(--green-700))',
  'Faculty of Business': 'linear-gradient(135deg,var(--gold-500),var(--gold-600))',
  'Faculty of Engineering': 'linear-gradient(135deg,var(--green-700),var(--green-800))',
  'Faculty of Law & Social Sciences': 'linear-gradient(135deg,var(--gold-600),var(--gold-700))',
};

export default function DepartmentsPage() {
  const { user } = useAuth();
  const { departments, elections, candidates, addToast, createDepartment, updateDepartment } = useElection();
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDept, setNewDept] = useState({ id: '', name: '', code: '', faculty: '' });

  const isAdmin = user?.role === 'admin';

  const getDeptStats = (deptId) => {
    const deptElecs = elections.filter(e => e.departmentId === deptId);
    const deptCands = candidates.filter(c => deptElecs.some(e => e.id === c.electionId));
    const totalVotes = deptElecs.reduce((s, e) => s + e.totalVotesCast, 0);
    const totalEligible = deptElecs.reduce((s, e) => s + e.eligibleVoterCount, 0);
    const turnout = totalEligible > 0 ? Math.round((totalVotes / totalEligible) * 100) : 0;
    const active = deptElecs.filter(e => e.status === 'active').length;
    return { elections: deptElecs.length, candidates: deptCands.length, totalVotes, turnout, active, deptElecs };
  };

  const handleSaveName = async (dept) => {
    try {
      await updateDepartment(dept.id, { name: editName });
      addToast({ type: 'success', title: 'Department Updated', message: `Name updated to "${editName}".` });
      setEditMode(false);
    } catch (e) {
      addToast({ type: 'error', title: 'Update Failed', message: e.message || 'Could not update department.' });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDept.id || !newDept.name || !newDept.code || !newDept.faculty) {
      addToast({ type: 'error', message: 'All fields are required.' });
      return;
    }
    try {
      await createDepartment(newDept);
      addToast({ type: 'success', title: 'Success', message: 'Department created successfully.' });
      setAddOpen(false);
      setNewDept({ id: '', name: '', code: '', faculty: '' });
    } catch (err) {
      addToast({ type: 'error', title: 'Creation Failed', message: err.message || 'Failed to create department.' });
    }
  };

  const turnoutChartData = departments.map((d, i) => {
    const { turnout } = getDeptStats(d.id);
    return { name: d.code, turnout, color: DEPT_COLORS[i % DEPT_COLORS.length] };
  });

  const tooltipStyle = { background: '#fff', border: '1px solid var(--navy-100)', borderRadius: 10, fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy-900)', marginBottom: 4 }}>Department Management</h1>
          <p style={{ fontSize: 14, color: 'var(--navy-400)' }}>Overview of all {departments.length} university departments and their election activity.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} />Add Department
          </button>
        )}
      </div>

      {/* University-wide Turnout Chart */}
      <div className="card card-padded">
        <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 18 }}>Voter Turnout by Department (%)</h3>
        <div style={{ height: 200, minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={turnoutChartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--navy-50)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--navy-400)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--navy-400)' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Turnout']} />
              <Bar dataKey="turnout" radius={[6, 6, 0, 0]}>
                {turnoutChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {departments.map((dept, i) => {
          const stats = getDeptStats(dept.id);
          const isSelected = selected === dept.id;
          return (
            <div key={dept.id} className="card card-hover"
              style={{ cursor: 'pointer', border: isSelected ? '2px solid var(--accent-500)' : '1px solid rgba(139,170,212,0.2)', transition: 'all 0.2s' }}
              onClick={() => setSelected(isSelected ? null : dept.id)}>

              {/* Card header */}
              <div style={{ background: FACULTY_GRAD[dept.faculty] || DEPT_COLORS[i % DEPT_COLORS.length], padding: '20px 20px 16px', borderRadius: '15px 15px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={20} color="#fff" />
                  </div>
                  {isAdmin && isSelected && (
                    <button onClick={e => { e.stopPropagation(); setEditMode(true); setEditName(dept.name); }}
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#fff' }}>
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
                {editMode && isSelected
                  ? <div onClick={e => e.stopPropagation()} style={{ marginTop: 12 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="form-input" style={{ marginBottom: 8, background: 'rgba(255,255,255,0.9)' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleSaveName(dept)} className="btn btn-sm" style={{ background: '#fff', color: 'var(--emerald-600)', border: 'none', flex: 1 }}><Check size={13} />Save</button>
                      <button onClick={() => setEditMode(false)} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', flex: 1 }}><X size={13} /></button>
                    </div>
                  </div>
                  : <>
                    <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginTop: 12, letterSpacing: '-0.2px' }}>{dept.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{dept.faculty}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{dept.code}</div>
                  </>
                }
              </div>

              {/* Stats */}
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { icon: Users, label: 'Students', value: dept.studentCount || 0 },
                  { icon: Vote, label: 'Elections', value: stats.elections },
                  { icon: BarChart3, label: 'Turnout', value: `${stats.turnout}%` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-900)' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      <Icon size={11} />{label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div className="animate-fade-in" style={{ padding: '0 20px 20px', borderTop: '1px solid var(--navy-50)', paddingTop: 16 }}>
                  <h4 style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-700)', marginBottom: 10 }}>Election Activity</h4>
                  {stats.deptElecs.length === 0
                    ? <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>No elections for this department yet.</p>
                    : stats.deptElecs.map(el => (
                      <div key={el.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--navy-50)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy-700)', flex: 1, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.title}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: 'var(--navy-400)' }}>{el.totalVotesCast}/{el.eligibleVoterCount}</span>
                          <span className={`badge-${el.status}`} style={{ fontSize: 10 }}>● {el.status}</span>
                        </div>
                      </div>
                    ))
                  }
                  {stats.active > 0 && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--emerald-50)', borderRadius: 8, fontSize: 12, color: 'var(--emerald-700)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--emerald-500)' }} className="animate-pulse-slow" />
                      {stats.active} active election{stats.active > 1 ? 's' : ''} in progress
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Department Modal */}
      {addOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,22,40,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setAddOpen(false)}>
          <div className="card card-padded" style={{
            width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16,
            boxShadow: '0 12px 32px rgba(10,22,40,0.15)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--navy-900)', marginBottom: 16 }}>Add New Department</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Department ID</label>
                <input placeholder="e.g. dept-cs" value={newDept.id} onChange={e => setNewDept(p => ({ ...p, id: e.target.value }))} className="form-input" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Department Name</label>
                <input placeholder="e.g. Computer Science & Engineering" value={newDept.name} onChange={e => setNewDept(p => ({ ...p, name: e.target.value }))} className="form-input" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Code</label>
                <input placeholder="e.g. CSE" value={newDept.code} onChange={e => setNewDept(p => ({ ...p, code: e.target.value }))} className="form-input" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Faculty</label>
                <select value={newDept.faculty} onChange={e => setNewDept(p => ({ ...p, faculty: e.target.value }))} className="form-input" required style={{ color: 'var(--navy-800)', border: '1.5px solid var(--navy-100)' }}>
                  <option value="">Select Faculty...</option>
                  <option value="Faculty of Computing & IT">Faculty of Computing & IT</option>
                  <option value="Faculty of Business">Faculty of Business</option>
                  <option value="Faculty of Engineering">Faculty of Engineering</option>
                  <option value="Faculty of Law & Social Sciences">Faculty of Law & Social Sciences</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
