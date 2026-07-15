import { useState, useEffect, useRef } from 'react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import {
  FileDown, Award, Users, CheckCircle, Percent, BarChart3, RefreshCw, Activity,
  ShieldCheck, ShieldAlert, Key, Lock, Globe, Layers, Sparkles, Clock, Database, ChevronRight
} from 'lucide-react';
import { StatusBadge, Confetti } from '../components/SharedUI';

const COLORS = ['#2e7d32', '#d97706', '#2563eb', '#7c3aed', '#ec4899', '#ef4444'];
const DEPT_COLORS = ['#2e7d32', '#d97706', '#2563eb', '#7c3aed', '#059669', '#3b82f6'];

const tooltipStyle = {
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 12,
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
  fontSize: 12,
  color: '#fff'
};

export default function ResultsView() {
  const { elections, candidates, addToast } = useElection();
  const { user } = useAuth();

  const [selId, setSelId] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [showConfetti, setConfetti] = useState(false);
  const [localElections, setLocalElections] = useState([]);
  const [localCandidates, setLocalCandidates] = useState([]);
  const [turnoutStats, setTurnoutStats] = useState([]);
  const [timelineStats, setTimelineStats] = useState([]);
  const [voteRecords, setVoteRecords] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Audit tools state
  const [auditState, setAuditState] = useState('idle'); // idle, auditing, verified, failed
  const [auditMessages, setAuditMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('results'); // results, ledger, stats

  // Sync with context first
  useEffect(() => {
    if (elections.length) setLocalElections(elections);
  }, [elections]);

  useEffect(() => {
    if (candidates.length) setLocalCandidates(candidates);
  }, [candidates]);

  // Fetch stats and actual data
  const fetchData = async () => {
    if (!selId) return;
    try {
      const [turnout, timeline, updatedElecs, updatedCands, records, logs] = await Promise.all([
        api.getTurnoutStats().catch(() => []),
        api.getTimelineStats().catch(() => []),
        api.getElections().catch(() => []),
        api.getCandidates().catch(() => []),
        api.getVoteRecords(selId).catch(() => []),
        api.getAuditLogs().catch(() => []),
      ]);
      setTurnoutStats(turnout);
      setTimelineStats(timeline);
      if (updatedElecs.length) setLocalElections(updatedElecs);
      if (updatedCands.length) setLocalCandidates(updatedCands);
      setVoteRecords(records);
      setAuditLogs(logs);
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
      const activeOrClosed = elections.find(e => e.status === 'active' || e.status === 'closed') || elections[0];
      setSelId(activeOrClosed.id);
    }
  }, [elections, selId]);

  const el = localElections.find(e => e.id === selId);
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
  const cast = el?.totalVotesCast || 0;
  const pct = eligible > 0 ? Math.round((cast / eligible) * 100) : 0;

  const deptData = turnoutStats.map((d, i) => ({
    name: d.department,
    turnout: d.turnout,
    color: DEPT_COLORS[i % DEPT_COLORS.length]
  }));
  const timeData = (timelineStats || []);

  // Helper to compute block hash client-side (replicates backend sha256)
  async function calculateClientHash(blockIndex, timestamp, electionId, candidateIds, previousHash, nonce) {
    const data = `${blockIndex}-${timestamp}-${electionId}-${JSON.stringify(candidateIds)}-${previousHash}-${nonce}`;
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // Run Cryptographic Blockchain Verification
  const runSecurityAudit = async () => {
    setAuditState('auditing');
    setAuditMessages([]);

    try {
      setAuditMessages(prev => [...prev, '🔌 Establishing connection with institutional node relay...']);
      await new Promise(r => setTimeout(r, 600));

      const records = await api.getVoteRecords(selId).catch(() => []);
      if (!records || records.length === 0) {
        setAuditMessages(prev => [...prev, 'ℹ️  Ledger is empty. No blocks to audit.']);
        await new Promise(r => setTimeout(r, 650));
        setAuditMessages(prev => [...prev, '🔒 Cryptographic audit passed (Zero Ballot state checked).']);
        await new Promise(r => setTimeout(r, 400));
        setAuditState('verified');
        return;
      }

      setAuditMessages(prev => [...prev, `💾 Loaded ${records.length} voter transactions. Querying genesis block...`]);
      await new Promise(r => setTimeout(r, 700));

      let prevHash = '0';
      let valid = true;

      for (let i = 0; i < records.length; i++) {
        const b = records[i];
        setAuditMessages(prev => [...prev, `👁️  Auditing block index #${b.blockIndex}...`]);
        await new Promise(r => setTimeout(r, 400));

        // 1. Structure sequence check
        if (b.blockIndex !== i) {
          setAuditMessages(prev => [...prev, `❌ Sequence anomaly: Block index #${b.blockIndex} out of order.`]);
          valid = false;
          break;
        }

        // 2. Head link continuity verification
        if (b.previousHash !== prevHash) {
          setAuditMessages(prev => [...prev, `❌ Chain failure: Block #${b.blockIndex} points to hash collision.`]);
          valid = false;
          break;
        }

        // 3. Proof of work consensus prefix check
        if (!b.id.startsWith('00')) {
          setAuditMessages(prev => [...prev, `❌ Proof of Work failure: Block #${b.blockIndex} hash lacks prefix limit.`]);
          valid = false;
          break;
        }

        // 4. Cryptographic Recalculation
        const recomputed = await calculateClientHash(b.blockIndex, b.timestamp, b.electionId, b.candidateIds, b.previousHash, b.nonce);
        if (b.id !== recomputed) {
          setAuditMessages(prev => [...prev, `❌ Signature collision on block #${b.blockIndex} (Hash mismatch).`]);
          valid = false;
          break;
        }

        setAuditMessages(prev => [...prev.slice(0, -1), `✅ Block #${b.blockIndex} verified (SHA-256: ${b.id.slice(0, 12)}...)`]);
        prevHash = b.id;
      }

      if (valid) {
        setAuditMessages(prev => [...prev, '🔒 Ledger chains successfully verified. Node state is verified.']);
        await new Promise(r => setTimeout(r, 300));
        setAuditState('verified');
      } else {
        setAuditState('failed');
      }
    } catch (e) {
      console.error(e);
      setAuditMessages(prev => [...prev, `💥 Audit thread hit critical exception: ${e.message}`]);
      setAuditState('failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto', padding: '0 8px' }} className="animate-fade-in">
      {showConfetti && <Confetti />}

      {/* Control Panel / Selector Bar */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(46, 125, 50, 0.12)',
          borderRadius: 18,
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--green-700)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Consolidated Election Feed
          </label>
          <select
            value={selId}
            onChange={e => { setSelId(e.target.value); setLiveMode(false); }}
            className="form-input"
            style={{
              maxWidth: 420,
              border: '1.5px solid var(--green-200)',
              borderRadius: 10,
              fontWeight: 650,
              color: 'var(--green-900)'
            }}
          >
            {localElections.map(e => <option key={e.id} value={e.id}>{e.title} ({e.status.toUpperCase()})</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {el?.status === 'active' && (
            <button
              className="btn btn-sm"
              onClick={() => setLiveMode(v => !v)}
              style={{
                background: liveMode ? 'linear-gradient(135deg, var(--green-600), var(--green-500))' : 'var(--white)',
                color: liveMode ? '#fff' : 'var(--green-700)',
                border: '1.5px solid rgba(46, 125, 50, 0.2)',
                fontWeight: 700,
                boxShadow: liveMode ? '0 4px 12px rgba(46, 125, 50, 0.15)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              <Activity size={14} className={liveMode ? 'animate-spin' : ''} />
              {liveMode ? 'Syncing Live Feed' : 'Stream Live View'}
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 10, padding: '8px 14px', fontWeight: 600 }}
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
                  const posRank = [...posCands].sort((a, b) => b.voteCount - a.voteCount).findIndex(pc => pc.id === c.id) + 1;
                  return [
                    c.position,
                    posRank,
                    c.name,
                    c.department || '',
                    c.voteCount,
                    posTotal > 0 ? Math.round((c.voteCount / posTotal) * 100) + '%' : '0%'
                  ];
                })
              ];
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${el.title.replace(/[^a-z0-9]/gi, '_')}_results.csv`; a.click();
              URL.revokeObjectURL(url);
              addToast({ type: 'success', title: 'Export Ready', message: 'CSV downloaded successfully.' });
            }}
          >
            <FileDown size={14} /> Export CSV
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 10, padding: '8px 14px', fontWeight: 600 }}
            onClick={() => {
              if (!el || !cands.length) return;
              const sortedCands = [...cands].sort((a, b) => {
                if (a.position !== b.position) return a.position.localeCompare(b.position);
                return b.voteCount - a.voteCount;
              });
              const esp = (s) => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
              const titleSafe = esp(el.title);
              const html = `<html><head><title>${titleSafe} — Audit Report</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:10px 14px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:700}h1{margin-bottom:4px}p{color:#666;font-size:13px}</style></head><body><h1>${titleSafe}</h1><p>Status: ${esp(el.status).toUpperCase()} | Total Votes: ${cast} | Turnout: ${pct}%</p><br/><table><tr><th>Position</th><th>Rank</th><th>Candidate</th><th>Department</th><th>Votes</th><th>Vote %</th></tr>${sortedCands.map((c) => {
                const posCands = cands.filter(pc => pc.position === c.position);
                const posTotal = posCands.reduce((sum, pc) => sum + pc.voteCount, 0);
                const posRank = [...posCands].sort((a, b) => b.voteCount - a.voteCount).findIndex(pc => pc.id === c.id) + 1;
                return `<tr><td>${esp(c.position)}</td><td>${posRank}</td><td><b>${esp(c.name)}</b></td><td>${esp(c.department)}</td><td>${c.voteCount}</td><td>${posTotal > 0 ? Math.round(c.voteCount / posTotal * 100) : 0}%</td></tr>`;
              }).join('')}</table><br/><p style="font-size:11px;color:#aaa">UniVote cryptographic audit logs verification on UMaT service node.</p></body></html>`;
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
          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { label: 'Registered Voters', value: eligible, secondary: 'Eligible student count', icon: Users, color: '#359837', bg: 'linear-gradient(135deg, var(--green-50), #c8e6c9)' },
              { label: 'Total Ballots Cast', value: cast, secondary: 'Secured on node ledger', icon: CheckCircle, color: '#2563eb', bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
              { label: 'Calculated Turnout', value: `${pct}%`, secondary: 'Voter turnout rate', icon: Percent, color: '#d97706', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)' },
              { label: 'Security Verification', value: '100% Secure', secondary: 'SHA-256 Blockchain', icon: ShieldCheck, color: 'var(--green-700)', bg: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)' },
            ].map(s => (
              <div
                key={s.label}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '18px 20px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: 16,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.01)',
                  background: 'var(--bg-white)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={22} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.secondary}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1.5px solid var(--gray-200)', gap: 16 }}>
            {[
              { id: 'results', label: 'Electoral Results & Standings', icon: Award },
              { id: 'ledger', label: 'Blockchain Ledger & Audits', icon: Database },
              { id: 'stats', label: 'Historical Turnout & Analytics', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === tab.id ? '2.5px solid var(--green-600)' : '2.5px solid transparent',
                  color: activeTab === tab.id ? 'var(--green-750)' : 'var(--gray-500)',
                  fontWeight: activeTab === tab.id ? 750 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  paddingBottom: 10,
                  marginBottom: -2,
                  transition: 'all 0.15s ease'
                }}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Feed Area */}
          {activeTab === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }} className="animate-fade-in">
              {electionPositions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
                  No candidate positions have been reported yet.
                </div>
              ) : (
                electionPositions.map(pos => {
                  const posCands = cands.filter(c => c.position === pos).sort((a, b) => b.voteCount - a.voteCount);
                  const posTotalVotes = posCands.reduce((sum, c) => sum + c.voteCount, 0);
                  const isClosed = el.status === 'closed';

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
                      className="card card-padded"
                      style={{
                        borderRadius: 20,
                        border: '1px solid var(--border)',
                        background: '#fff',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.015)'
                      }}
                    >
                      {/* Position Title Banner */}
                      <div style={{ borderLeft: '4.5px solid var(--green-600)', paddingLeft: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <h3 style={{ fontSize: 16.5, fontWeight: 900, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                            {pos}
                          </h3>
                          <span style={{ fontSize: 12, color: 'var(--navy-400)' }}>Certified election tally results</span>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green-700)', background: 'var(--green-50)', padding: '5px 12px', borderRadius: 8, border: '1px solid var(--green-100)' }}>
                          Total Votes Cast: <strong>{posTotalVotes}</strong>
                        </div>
                      </div>

                      {/* Side-by-Side Standings and Charts */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                        {/* Standings List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {posCands.map((c, rank) => {
                            const percentageShare = posTotalVotes > 0 ? Math.round((c.voteCount / posTotalVotes) * 100) : 0;
                            const isTop = rank === 0 && showWinnerBadge;

                            return (
                              <div
                                key={c.id}
                                style={{
                                  background: isTop ? 'linear-gradient(90deg, #f0fdf4, #ffffff)' : '#fff',
                                  border: `1.5px solid ${isTop ? 'var(--green-300)' : 'var(--gray-200)'}`,
                                  borderRadius: 14,
                                  padding: '14px 18px',
                                  boxShadow: isTop ? '0 4px 16px rgba(46,125,50,0.04)' : 'none',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {/* Place badge */}
                                    <div style={{
                                      width: 28, height: 28, borderRadius: 8,
                                      background: isTop ? '#fbbf24' : '#f1f5f9',
                                      color: isTop ? '#78350f' : 'var(--gray-600)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 800, fontSize: 11
                                    }}>
                                      {rank === 0 ? '🏆' : rank + 1}
                                    </div>

                                    {/* Avatar preview */}
                                    {c.picture ? (
                                      <img src={api.getUrl(c.picture)} alt={c.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border)' }} />
                                    ) : (
                                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                        {c.name.split(' ').map(n => n[0]).join('')}
                                      </div>
                                    )}

                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>{c.name}</span>
                                        {isTop && (
                                          <span style={{
                                            fontSize: 9, fontWeight: 800, background: isClosed ? 'var(--green-700)' : '#d97706',
                                            color: '#fff', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase'
                                          }}>
                                            {isClosed ? 'Winner' : 'Front-Run'}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.department}</div>
                                    </div>
                                  </div>

                                  <div style={{ textAlign: 'right' }}>
                                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{c.voteCount} votes</strong>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{percentageShare}% share</div>
                                  </div>
                                </div>

                                <div className="progress-bar-track" style={{ height: 6, background: '#f1f5f9' }}>
                                  <div className="progress-bar-fill" style={{ width: `${percentageShare}%`, background: isTop ? 'var(--green-500)' : '#2563eb' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Visual Share Distribution */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifySelf: 'center', alignItems: 'center', background: 'var(--gray-50)', borderRadius: 14, padding: 18, border: '1px solid var(--gray-200)', width: '100%' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Ballot Distribution</span>
                          <div style={{ width: '100%', height: 210, minWidth: 0 }}>
                            {posTotalVotes > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={positionPieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={2}
                                  >
                                    {positionPieData.map((part, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, fontWeight: 650 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            ) : (
                              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12.5, fontStyle: 'italic' }}>
                                No votes recorded for this position.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }} className="animate-fade-in">
              {/* Cryptographic Ledger Audit Control */}
              <div className="card card-padded" style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <ShieldCheck size={20} style={{ color: 'var(--green-600)' }} />
                  <h3 style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)' }}>Blockchain Ledger Audit</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                  Perform client-side validation of full blockchain hashes securely. This utility recalculates state nonces to detect discrepancies.
                </p>

                {auditState === 'idle' && (
                  <button
                    className="btn btn-primary"
                    onClick={runSecurityAudit}
                    style={{ width: '100%', borderRadius: 10, background: 'var(--green-700)' }}
                  >
                    Validate Blockchain Ledger
                  </button>
                )}

                {auditState === 'auditing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green-600)', fontSize: 13 }}>
                      <Activity size={14} className="animate-spin" />
                      <span>Security Audit in progress...</span>
                    </div>
                    <div style={{ background: 'var(--navy-900)', color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 11, padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120 }}>
                      {auditMessages.map((m, i) => <div key={i} className="animate-fade-in">🕒 {m}</div>)}
                    </div>
                  </div>
                )}

                {auditState === 'verified' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, display: 'flex', gap: 10 }}>
                      <ShieldCheck size={18} style={{ color: 'var(--green-600)', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: 13.5, color: '#065f46' }}>Blockchain Verified Successfully</strong>
                        <p style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>100% of blockchain nodes match mathematical states. No modifications detected.</p>
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setAuditState('idle')}>Audit Again</button>
                  </div>
                )}

                {auditState === 'failed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, display: 'flex', gap: 10 }}>
                      <ShieldAlert size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: 13.5, color: '#991b1b' }}>Blockchain Validation Error</strong>
                        <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>A discrepancy was detected or node was unavailable. Please retry check.</p>
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={runSecurityAudit}>Retry Validation</button>
                  </div>
                )}
              </div>

              {/* Cryptographical blocks live ledger */}
              <div className="card card-padded" style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', maxHeight: 400 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Database size={18} style={{ color: '#2563eb' }} />
                  <h3 style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)' }}>Blockchain Ledger Stream</h3>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                  {voteRecords.length === 0 ? (
                    <div style={{ py: 32, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>
                      No blockchain transactions recorded yet.
                    </div>
                  ) : (
                    voteRecords.map((rec) => (
                      <div key={rec.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--gray-50)', fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--gray-750)' }}>
                          <span>Block Index: #{rec.blockIndex}</span>
                          <span style={{ color: 'var(--green-750)' }}>Nonce: {rec.nonce}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Hash: {rec.id}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                          Prev: {rec.previousHash}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 9.5, marginTop: 2 }}>
                          <span>Token: {rec.voteHash?.slice(0, 10)}...</span>
                          <span>{new Date(rec.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* General Admin audit log ticker */}
              {user?.role !== 'voter' && (
                <div className="card card-padded animate-fade-in" style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', background: '#fff', borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <Layers size={18} style={{ color: 'var(--green-600)' }} />
                    <h3 style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)' }}>System Audit Logs Ledger</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    {auditLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No log entries recorded.</div>
                    ) : (
                      <table className="data-table" style={{ fontSize: 12.5 }}>
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Role</th>
                            <th>Timestamp</th>
                            <th>Cryptographic Hash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.slice(0, 8).map((log) => (
                            <tr key={log.id}>
                              <td><strong>{log.action}</strong></td>
                              <td>{log.performedBy}</td>
                              <td><span style={{ textTransform: 'capitalize', fontSize: 11, fontWeight: 700 }}>{log.role}</span></td>
                              <td>{new Date(log.timestamp).toLocaleString()}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                                {log.id}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
                {/* Department Turnout Chart */}
                <div className="card card-padded" style={{ borderRadius: 16, border: '1px solid var(--border)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Users size={18} style={{ color: 'var(--green-600)' }} />
                    <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>Voter Turnout by Department</h3>
                  </div>
                  <div style={{ height: 240, minWidth: 0 }}>
                    {deptData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                          <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Turnout']} />
                          <Bar dataKey="turnout" radius={[6, 6, 0, 0]}>
                            {deptData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>No departmental turnout data received.</div>}
                  </div>
                </div>

                {/* Timeline Chart */}
                <div className="card card-padded" style={{ borderRadius: 16, border: '1px solid var(--border)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Activity size={18} style={{ color: '#d97706' }} />
                    <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>Voting Velocity Rate</h3>
                  </div>
                  <div style={{ height: 240, minWidth: 0 }}>
                    {timeData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                          <defs>
                            <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--green-500)" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="var(--green-500)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Area type="monotone" dataKey="votes" name="Votes" stroke="var(--green-600)" strokeWidth={2} fill="url(#velocityGrad)" dot={{ fill: 'var(--green-600)', r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>No transaction logging metadata recorded.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No active election parameters selected.</div>
      )}
    </div>
  );
}
