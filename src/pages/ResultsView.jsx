import { useState, useEffect, useRef } from 'react';
import { useElection } from '../context/ElectionContext';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { FileDown, Award, Users, CheckCircle, Percent, BarChart3, RefreshCw, Activity } from 'lucide-react';
import { StatusBadge, Confetti } from '../components/SharedUI';

const COLORS = ['#2563eb','#7c3aed','#059669','#f59e0b','#ec4899','#ef4444'];
const DEPT_COLORS = ['#2563eb','#7c3aed','#059669','#f59e0b'];

const tooltipStyle = {
  background: '#fff', border: '1px solid var(--navy-100)',
  borderRadius: 10, boxShadow: '0 4px 16px rgba(10,22,40,0.1)', fontSize: 13
};

export default function ResultsView() {
  const { elections, candidates, addToast } = useElection();

  const [selId, setSelId]         = useState('');
  const [liveMode, setLiveMode]   = useState(false);
  const [showConfetti, setConfetti] = useState(false);
  const [localElections, setLocalElections] = useState([]);
  const [localCandidates, setLocalCandidates] = useState([]);
  const [turnoutStats, setTurnoutStats] = useState([]);
  const [timelineStats, setTimelineStats] = useState([]);

  // Sync with context first
  useEffect(() => {
    if (elections.length) setLocalElections(elections);
  }, [elections]);

  useEffect(() => {
    if (candidates.length) setLocalCandidates(candidates);
  }, [candidates]);

  // Fetch stats and actual data
  const fetchData = async () => {
    try {
      const [turnout, timeline, updatedElecs, updatedCands] = await Promise.all([
        api.getTurnoutStats().catch(() => []),
        api.getTimelineStats().catch(() => []),
        api.getElections().catch(() => []),
        api.getCandidates().catch(() => []),
      ]);
      setTurnoutStats(turnout);
      setTimelineStats(timeline);
      if (updatedElecs.length) setLocalElections(updatedElecs);
      if (updatedCands.length) setLocalCandidates(updatedCands);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selId]);

  // Live Mode polling
  useEffect(() => {
    let timer;
    if (liveMode) {
      timer = setInterval(fetchData, 3000);
    }
    return () => clearInterval(timer);
  }, [liveMode]);

  // Default election selection
  useEffect(() => {
    if (!selId && elections.length) {
      setSelId((elections.find(e => e.status === 'closed') || elections[0]).id);
    }
  }, [elections, selId]);

  const el    = localElections.find(e => e.id === selId);
  const cands = el ? localCandidates.filter(c => c.electionId === el.id) : [];

  const electionPositions = Array.from(new Set(cands.map(c => c.position).filter(Boolean)));

  // Trigger confetti on election closed
  useEffect(() => {
    if (el?.status === 'closed') {
      setConfetti(true);
      const t = setTimeout(() => setConfetti(false), 5000);
      return () => clearTimeout(t);
    }
  }, [el?.id, el?.status]);

  const eligible = el?.eligibleVoterCount || 0;
  const cast     = el?.totalVotesCast || 0;
  const pct      = eligible > 0 ? Math.round((cast / eligible) * 100) : 0;

  const deptData = turnoutStats.map((d, i) => ({ name: d.department, turnout: d.turnout, color: DEPT_COLORS[i % DEPT_COLORS.length] }));
  const timeData = (timelineStats || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }} className="animate-fade-in">
      {showConfetti && <Confetti />}

      {/* Control Panel / Selector Bar */}
      <div 
        style={{ 
          background: 'rgba(255, 255, 255, 0.75)', 
          backdropFilter: 'blur(10px)', 
          border: '1.5px solid rgba(46, 125, 50, 0.12)', 
          borderRadius: 16, 
          padding: 24, 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: 20,
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.04)'
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Active Dashboard Feed
          </label>
          <select 
            value={selId} 
            onChange={e => { setSelId(e.target.value); setLiveMode(false); }} 
            className="form-input" 
            style={{ 
              maxWidth: 420, 
              border: '1.5px solid var(--green-200)', 
              borderRadius: 10,
              fontWeight: 600,
              color: 'var(--green-900)'
            }}
          >
            {elections.map(e => <option key={e.id} value={e.id}>{e.title} ({e.status.toUpperCase()})</option>)}
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {el?.status === 'active' && (
            <button
              className="btn btn-sm"
              onClick={() => setLiveMode(v => !v)}
              style={{ 
                background: liveMode ? 'linear-gradient(135deg, var(--green-600), var(--green-500))' : 'var(--green-50)', 
                color: liveMode ? '#fff' : 'var(--green-700)', 
                border: '1.5px solid rgba(46, 125, 50, 0.2)', 
                fontWeight: 700,
                boxShadow: liveMode ? '0 4px 12px rgba(46, 125, 50, 0.25)' : 'none',
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                transition: 'all 0.3s ease'
              }}
            >
              <Activity size={14} className={liveMode ? 'animate-spin' : ''} />
              {liveMode ? 'Live Mode Active' : 'Enable Live View'}
            </button>
          )}
          
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ borderRadius: 10, padding: '8px 16px', fontWeight: 600 }}
            onClick={() => {
              if (!el || !cands.length) return;
              const rows = [
                ['Position', 'Rank', 'Candidate', 'Department', 'Votes', 'Vote %'],
                ...[...cands].sort((a, b) => {
                  if (a.position !== b.position) return a.position.localeCompare(b.position);
                  return b.voteCount - a.voteCount;
                }).map(c => {
                  const posCands = cands.filter(pc => pc.position === c.position);
                  const posTotal = posCands.reduce((sum, pc) => sum + pc.voteCount, 0);
                  const posRank = [...posCands].sort((a,b)=>b.voteCount-a.voteCount).findIndex(pc => pc.id === c.id) + 1;
                  return [
                    c.position,
                    posRank,
                    c.name,
                    c.department || '',
                    c.voteCount,
                    posTotal > 0 ? Math.round((c.voteCount/posTotal)*100)+'%' : '0%'
                  ];
                })
              ];
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${el.title.replace(/[^a-z0-9]/gi,'_')}_results.csv`; a.click();
              URL.revokeObjectURL(url);
              addToast({ type: 'success', title: 'Export Ready', message: 'CSV downloaded successfully.' });
            }}
          >
            <FileDown size={14} /> Export CSV
          </button>
          
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ borderRadius: 10, padding: '8px 16px', fontWeight: 600 }}
            onClick={() => {
              if (!el || !cands.length) return;
              const sortedCands = [...cands].sort((a, b) => {
                if (a.position !== b.position) return a.position.localeCompare(b.position);
                return b.voteCount - a.voteCount;
              });
              const html = `<html><head><title>${el.title} — Results</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:10px 14px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:700}h1{margin-bottom:4px}p{color:#666;font-size:13px}</style></head><body><h1>${el.title}</h1><p>Status: ${el.status.toUpperCase()} | Total Votes Cast: ${cast} | Turnout: ${pct}%</p><br/><table><tr><th>Position</th><th>Rank</th><th>Candidate</th><th>Department</th><th>Votes</th><th>Vote %</th></tr>${sortedCands.map((c) => {
                const posCands = cands.filter(pc => pc.position === c.position);
                const posTotal = posCands.reduce((sum, pc) => sum + pc.voteCount, 0);
                const posRank = [...posCands].sort((a,b)=>b.voteCount-a.voteCount).findIndex(pc => pc.id === c.id) + 1;
                return `<tr><td>${c.position}</td><td>${posRank}</td><td><b>${c.name}</b></td><td>${c.department||''}</td><td>${c.voteCount}</td><td>${posTotal>0?Math.round(c.voteCount/posTotal*100):0}%</td></tr>`;
              }).join('')}</table><br/><p style="font-size:11px;color:#aaa">Generated by UniVote ACSES UMaT · ${new Date().toLocaleString()}</p></body></html>`;
              const win = window.open('', '_blank');
              win.document.write(html);
              win.document.close();
              win.print();
            }}
          >
            <FileDown size={14} /> Print Report
          </button>
        </div>
      </div>

      {el ? (
        <>
          {/* Quick Jump Position Selector */}
          {electionPositions.length > 1 && (
            <div style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              borderBottom: '1.5px solid var(--border)',
              paddingBottom: 20,
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-500)', marginRight: 4 }}>
                Filter/Jump to Position:
              </span>
              {electionPositions.map(pos => (
                <button
                  key={pos}
                  onClick={() => {
                    document.getElementById(`position-section-${pos.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: 20, padding: '6px 14px', fontWeight: 600, border: '1px solid var(--green-200)', color: 'var(--green-800)', background: 'var(--green-50)' }}
                >
                  {pos}
                </button>
              ))}
            </div>
          )}

          {/* Live Polling Banner */}
          {liveMode && (
            <div 
              className="animate-fade-in" 
              style={{ 
                background: 'var(--green-50)', 
                border: '1.5px solid var(--green-200)', 
                borderRadius: 14, 
                padding: '14px 20px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                boxShadow: '0 4px 12px rgba(46, 125, 50, 0.05)'
              }}
            >
              <div 
                style={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%', 
                  background: 'var(--green-500)',
                  boxShadow: '0 0 0 4px rgba(46, 125, 50, 0.2)'
                }} 
                className="animate-pulse-slow" 
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-800)' }}>
                Real-Time Stream Active — Chart updates and data components are syncing with the database feed.
              </span>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: Users,       label: 'Eligible Voters', value: eligible,   color: 'var(--green-600)', bgGradient: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' },
              { icon: CheckCircle, label: 'Ballots Cast',    value: cast,       color: '#7c3aed', bgGradient: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)' },
              { icon: Percent,     label: 'Global Turnout',  value: `${pct}%`,  color: 'var(--gold-700)', bgGradient: 'linear-gradient(135deg, #fffbeb, #fef3c7)' },
              { icon: Award,       label: 'Candidates',      value: cands.length, color: '#2563eb', bgGradient: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
            ].map(s => (
              <div 
                key={s.label} 
                className="card" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 16, 
                  padding: '20px 24px', 
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.02)';
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bgGradient, display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Results by Each and Every Position on Board */}
          {electionPositions.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '64px 24px', 
              color: 'var(--navy-400)', 
              fontSize: 14, 
              fontStyle: 'italic', 
              background: 'var(--bg-white)', 
              borderRadius: 16, 
              border: '1.5px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
              No positions or candidates have been registered for this election yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              {electionPositions.map(pos => {
                const posCands = cands.filter(c => c.position === pos).sort((a, b) => b.voteCount - a.voteCount);
                const posTotalVotes = posCands.reduce((sum, c) => sum + c.voteCount, 0);
                const isClosed = el.status === 'closed';
                
                // Winner declared if closed, otherwise leading candidate
                const leadingCand = posCands[0];
                const showWinnerBadge = leadingCand && (isClosed || leadingCand.voteCount > 0);

                const positionPieData = posCands.map(c => ({
                  name: c.name,
                  value: c.voteCount,
                  color: c.color || '#2e7d32'
                }));

                return (
                  <div 
                    key={pos}
                    id={`position-section-${pos.replace(/\s+/g, '-')}`}
                    className="card card-padded animate-fade-in"
                    style={{
                      borderRadius: 20,
                      border: '1.5px solid var(--border)',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
                      scrollMarginTop: 80
                    }}
                  >
                    {/* Position Header */}
                    <div style={{
                      borderLeft: '4px solid var(--green-600)',
                      paddingLeft: 14,
                      marginBottom: 24,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12
                    }}>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
                          {pos}
                        </h3>
                        <p style={{ fontSize: 12.5, color: 'var(--navy-400)', marginTop: 2, margin: 0 }}>
                          Position Ballot Results Breakdown
                        </p>
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--green-700)',
                        background: 'var(--green-50)',
                        padding: '4px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--green-100)'
                      }}>
                        Total Position Votes: <strong>{posTotalVotes}</strong>
                      </div>
                    </div>

                    {/* Position Content Layout */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                      gap: 24
                    }}>
                      {/* Left side: Rankings / Candidates */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {posCands.map((c, rank) => {
                          const percentageShare = posTotalVotes > 0 ? Math.round((c.voteCount / posTotalVotes) * 100) : 0;
                          const isTop = rank === 0 && showWinnerBadge;
                          
                          return (
                            <div 
                              key={c.id}
                              style={{
                                background: isTop ? 'linear-gradient(90deg, var(--green-50), #fff)' : 'var(--bg-white)',
                                border: `1.5px solid ${isTop ? 'var(--green-300)' : 'var(--border)'}`,
                                borderRadius: 14,
                                padding: '16px 20px',
                                position: 'relative',
                                boxShadow: isTop ? '0 4px 16px rgba(46,125,50,0.05)' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  {/* Ranking Badge */}
                                  <div 
                                    style={{ 
                                      width: 32, 
                                      height: 32, 
                                      borderRadius: 8, 
                                      background: isTop ? 'var(--gold-400)' : c.color || 'var(--green-600)', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      color: isTop ? 'var(--green-950)' : '#fff', 
                                      fontWeight: 800, 
                                      fontSize: 12, 
                                      flexShrink: 0
                                    }}
                                  >
                                    {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
                                  </div>
                                  
                                  {/* Photo preview */}
                                  {c.picture ? (
                                    <img src={c.picture} alt={c.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c.color || 'var(--border)'}`, flexShrink: 0 }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.color || 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                                      {c.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                  )}
                                  
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)' }}>{c.name}</span>
                                      {isTop && (
                                        <span style={{
                                          fontSize: 9.5,
                                          fontWeight: 800,
                                          background: isClosed ? 'var(--green-600)' : 'var(--gold-500)',
                                          color: isClosed ? '#fff' : 'var(--green-950)',
                                          padding: '2px 8px',
                                          borderRadius: 4,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.05em'
                                        }}>
                                          {isClosed ? 'Winner' : 'Leading'}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.department}</span>
                                  </div>
                                </div>
                                
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>{c.voteCount} votes</span>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2 }}>{percentageShare}% Share</div>
                                </div>
                              </div>
                              
                              <div className="progress-bar-track" style={{ height: 8, background: 'var(--gray-100)' }}>
                                <div className="progress-bar-fill" style={{ width: `${percentageShare}%`, background: c.color || 'var(--green-500)' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right side: Visual Representation (Pie Chart) */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'var(--gray-50)',
                        borderRadius: 16,
                        padding: 16,
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                          Ballot Share Distribution
                        </div>
                        <div style={{ width: '100%', height: 220, minHeight: 220 }}>
                          {posTotalVotes > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                              <PieChart>
                                <Pie 
                                  data={positionPieData} 
                                  dataKey="value" 
                                  nameKey="name" 
                                  cx="50%" 
                                  cy="50%" 
                                  innerRadius={50} 
                                  outerRadius={80} 
                                  paddingAngle={3}
                                >
                                  {positionPieData.map((p, i) => <Cell key={i} fill={p.color} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                              No ballots cast for this position yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Departmental & timeline analytics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
            {/* Department Turnout Chart */}
            <div className="card card-padded" style={{ borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Users size={18} style={{ color: 'var(--green-600)' }} />
                <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Turnout By Department</h3>
              </div>
              <div style={{ height: 260, minHeight: 260 }}>
                {deptData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={deptData} margin={{ top: 10, right: 5, left: -22, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Turnout']} />
                      <Bar dataKey="turnout" radius={[6,6,0,0]}>
                        {deptData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No turnout statistics collected yet.</div>}
              </div>
            </div>

            {/* Voting Activity Timeline Chart */}
            <div className="card card-padded" style={{ borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Activity size={18} style={{ color: 'var(--gold-600)' }} />
                <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Hourly Voting Velocity</h3>
              </div>
              <div style={{ height: 260, minHeight: 260 }}>
                {timeData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={timeData} margin={{ top: 10, right: 5, left: -22, bottom: 5 }}>
                      <defs>
                        <linearGradient id="voteGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--green-500)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--green-500)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="votes" name="Votes" stroke="var(--green-600)" strokeWidth={2.5} fill="url(#voteGrad)" dot={{ fill: 'var(--green-600)', r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No timeline statistics recorded yet.</div>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>Loading election results feed…</div>
      )}
    </div>
  );
}
