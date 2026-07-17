import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import {
    Users, CheckCircle, Percent, Activity, RefreshCw,
    Award, Database, TrendingUp, Sparkles, Clock, Globe
} from 'lucide-react';

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

export default function AgentView() {
    const [elections, setElections] = useState([]);
    const [selectedElectionId, setSelectedElectionId] = useState('');
    const [electionData, setElectionData] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [turnoutStats, setTurnoutStats] = useState([]);
    const [timelineStats, setTimelineStats] = useState([]);
    const [liveMode, setLiveMode] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Micro-animations and stats ticker
    const [flashNewVote, setFlashNewVote] = useState(false);
    const [previousVoteCount, setPreviousVoteCount] = useState(0);
    const [liveEvents, setLiveEvents] = useState([
        { id: 1, time: new Date(Date.now() - 60000).toLocaleTimeString(), msg: 'Decentralized tracker network established.', type: 'info' },
        { id: 2, time: new Date(Date.now() - 30000).toLocaleTimeString(), msg: 'Live connection verified. Fetching initial tallies...', type: 'success' }
    ]);

    // Fetch elections list on mount
    useEffect(() => {
        const fetchInitialElections = async () => {
            try {
                const elecs = await api.getElections();
                setElections(elecs);
                if (elecs.length > 0) {
                    const activeOrFirst = elecs.find(e => e.status === 'active') || elecs[0];
                    setSelectedElectionId(activeOrFirst.id);
                }
            } catch (err) {
                console.error('Failed to load elections:', err);
            }
        };
        fetchInitialElections();
    }, []);

    // Fetch live tracking data
    const fetchData = async () => {
        if (!selectedElectionId) return;
        try {
            // Fetch full campaign telemetry from the public tracking route in one call
            const data = await api.getPublicLiveStats(selectedElectionId);

            setLastUpdated(new Date());
            setElectionData(data.election);
            setCandidates(data.candidates || []);
            setTurnoutStats(data.turnoutStats || []);
            setTimelineStats(data.timelineStats || []);

            const currentCount = data.election?.totalVotesCast || 0;
            if (previousVoteCount > 0 && currentCount > previousVoteCount) {
                const diff = currentCount - previousVoteCount;
                setFlashNewVote(true);
                setTimeout(() => setFlashNewVote(false), 1500);

                // Add dynamic live tracking event
                const newEvent = {
                    id: Date.now(),
                    time: new Date().toLocaleTimeString(),
                    msg: `🗳️ Vote incoming: +${diff} ballot${diff > 1 ? 's' : ''} recorded. Current tally: ${currentCount}`,
                    type: 'vote'
                };
                setLiveEvents(prev => [newEvent, ...prev.slice(0, 15)]);

                // Trigger dynamic sound alert
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.frequency.setValueAtTime(580, audioCtx.currentTime);
                    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.08);
                } catch (e) { }
            }
            setPreviousVoteCount(currentCount);
        } catch (err) {
            console.error('Live statistics update failed:', err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedElectionId]);

    // Live polling timer (polls every 3 seconds)
    useEffect(() => {
        let timer;
        if (liveMode && selectedElectionId) {
            timer = setInterval(fetchData, 3000);
        }
        return () => clearInterval(timer);
    }, [liveMode, selectedElectionId, previousVoteCount]);

    const el = electionData || elections.find(e => e.id === selectedElectionId);
    const eligible = el?.eligibleVoterCount || 0;
    const cast = el?.totalVotesCast || 0;
    const pct = eligible > 0 ? Math.round((cast / eligible) * 100) : 0;

    const electionPositions = Array.from(new Set(candidates.map(c => c.position).filter(Boolean)));

    const deptData = turnoutStats.map((d, i) => ({
        name: d.department,
        turnout: d.turnout,
        color: DEPT_COLORS[i % DEPT_COLORS.length]
    }));

    const timeData = (timelineStats || []);

    return (
        <div style={{
            background: 'var(--bg-page, #f8fafc)',
            color: 'var(--text-primary, #0f172a)',
            minHeight: '100vh',
            padding: '24px 16px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* CNN-STYLE DECISION CENTER DESK BANNER */}
                <header style={{
                    background: 'linear-gradient(135deg, #1e3a24 0%, #0f2e1a 100%)',
                    color: '#fff',
                    border: '1px solid rgba(46, 125, 50, 0.2)',
                    borderRadius: 20,
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.08)',
                    gap: 16
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            background: '#22c55e',
                            color: '#000',
                            padding: '6px 14px',
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <span className="live-pulse-dot" style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#dc2626',
                                boxShadow: '0 0 10px #dc2626',
                                display: 'inline-block',
                                animation: 'pulse 1.2s infinite'
                            }} />
                            <span>LIVE TRACKING</span>
                        </div>
                        <div>
                            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.02em' }}>
                                UNIVOTE PORTAL CENTER
                            </h1>
                            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 650, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} />
                                Decision Desk Tally Feed (Updates every 3 seconds)
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {/* Direct selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e2e8f0' }}>TARGET CAMPAIGN:</span>
                            <select
                                value={selectedElectionId}
                                onChange={e => setSelectedElectionId(e.target.value)}
                                style={{
                                    background: '#041c10',
                                    border: '1.5px solid #22c55e',
                                    borderRadius: 10,
                                    padding: '7px 14px',
                                    color: '#fff',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {elections.map(e => <option key={e.id} value={e.id}>{e.title.toUpperCase()}</option>)}
                            </select>
                        </div>

                        <button
                            onClick={() => setLiveMode(!liveMode)}
                            style={{
                                background: liveMode ? '#22c55e' : '#fff',
                                color: liveMode ? '#000' : '#22c55e',
                                border: '1.5px solid rgba(34, 197, 94, 0.2)',
                                borderRadius: 10,
                                padding: '7px 16px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <RefreshCw size={13} className={liveMode ? 'animate-spin' : ''} />
                            {liveMode ? 'Syncing Live Tickers' : 'Pause Live Feed'}
                        </button>
                    </div>
                </header>

                {el ? (
                    <>
                        {/* Quick Metrics display */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                            {[
                                { label: 'Registered Voters', value: eligible, secondary: 'Eligible student count', icon: Users, color: '#359837', bg: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)' },
                                {
                                    label: 'Total Ballots Cast',
                                    value: cast,
                                    secondary: 'Recorded transaction nodes',
                                    icon: CheckCircle,
                                    color: '#2563eb',
                                    bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                    flash: flashNewVote
                                },
                                { label: 'Calculated Turnout', value: `${pct}%`, secondary: 'Voter turnout rate', icon: Percent, color: '#d97706', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)' },
                                { label: 'Tracking Sync', value: lastUpdated.toLocaleTimeString(), secondary: 'Last transaction check', icon: Globe, color: 'var(--green-700)', bg: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)' },
                            ].map((s, idx) => (
                                <div
                                    key={idx}
                                    className="card"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 16,
                                        padding: '18px 20px',
                                        border: '1px solid rgba(0,0,0,0.05)',
                                        borderRadius: 16,
                                        boxShadow: s.flash ? '0 0 20px rgba(34, 197, 94, 0.2)' : '0 4px 14px rgba(0,0,0,0.01)',
                                        background: s.flash ? '#e8f5e9' : '#fff',
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <s.icon size={22} style={{ color: s.color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-secondary, #64748b)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 905, color: '#000', marginTop: 2 }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.secondary}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Split screen results distribution + live feed status */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gap: 20,
                            alignItems: 'start'
                        }}>

                            {/* LEFT COLUMN: STANDINGS & PIE CHARTS EXACTLY AS RESULTS VIEW */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {electionPositions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 20, color: '#64748b', fontSize: 14 }}>
                                        No candidates have been registered under selected campaign yet.
                                    </div>
                                ) : (
                                    electionPositions.map(pos => {
                                        const posCands = candidates.filter(c => c.position === pos).sort((a, b) => b.voteCount - a.voteCount);
                                        const isUnopposed = posCands.length === 1;
                                        const posTotalVotes = isUnopposed ? cast : posCands.reduce((sum, c) => sum + c.voteCount, 0);

                                        const positionPieData = isUnopposed
                                            ? [
                                                { name: 'Yes', value: posCands[0].voteCount, color: posCands[0].color || '#2e7d32' },
                                                { name: 'No', value: Math.max(0, cast - posCands[0].voteCount), color: '#ef4444' }
                                            ]
                                            : posCands.map(c => ({
                                                name: c.name,
                                                value: c.voteCount,
                                                color: c.color || '#2e7d32'
                                            }));

                                        return (
                                            <div
                                                key={pos}
                                                className="card"
                                                style={{
                                                    borderRadius: 20,
                                                    border: '1.5px solid rgba(0,0,0,0.06)',
                                                    background: '#fff',
                                                    padding: 20,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 20,
                                                    boxShadow: '0 4px 16px rgba(0,0,0,0.01)'
                                                }}
                                            >
                                                {/* Position Title Banner */}
                                                <div style={{ borderLeft: '4.5px solid var(--green-600, #2e7d32)', paddingLeft: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                                    <div>
                                                        <h3 style={{ fontSize: 16.5, fontWeight: 900, color: 'var(--navy-900, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                                                            {pos}
                                                        </h3>
                                                        <span style={{ fontSize: 12, color: 'var(--navy-400, #64748b)' }}>Live tallies & progression standings</span>
                                                    </div>
                                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#166534', background: '#f0fdf4', padding: '5px 12px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                                                        Total Ballots in Category: <strong>{posTotalVotes}</strong>
                                                    </div>
                                                </div>

                                                {/* Side-by-Side Standings and Charts */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

                                                    {/* Standings List */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        {(isUnopposed ? [
                                                            {
                                                                id: `${posCands[0].id}-yes`,
                                                                name: `${posCands[0].name} (YES)`,
                                                                dept: posCands[0].department,
                                                                votes: posCands[0].voteCount,
                                                                share: posTotalVotes > 0 ? Math.round((posCands[0].voteCount / posTotalVotes) * 100) : 0,
                                                                avatar: posCands[0].picture,
                                                                color: 'var(--green-500, #22c55e)',
                                                                label: 'YES Support',
                                                                isWinner: posCands[0].voteCount >= (cast - posCands[0].voteCount)
                                                            },
                                                            {
                                                                id: `${posCands[0].id}-no`,
                                                                name: `${posCands[0].name} (NO)`,
                                                                dept: posCands[0].department,
                                                                votes: Math.max(0, cast - posCands[0].voteCount),
                                                                share: posTotalVotes > 0 ? Math.round((Math.max(0, cast - posCands[0].voteCount) / posTotalVotes) * 100) : 0,
                                                                avatar: null,
                                                                color: 'var(--red-500, #ef4444)',
                                                                label: 'NO Reject',
                                                                isWinner: (cast - posCands[0].voteCount) > posCands[0].voteCount
                                                            }
                                                        ] : posCands.map((c, rank) => ({
                                                            id: c.id,
                                                            name: c.name,
                                                            dept: c.department,
                                                            votes: c.voteCount,
                                                            share: posTotalVotes > 0 ? Math.round((c.voteCount / posTotalVotes) * 100) : 0,
                                                            avatar: c.picture,
                                                            color: rank === 0 ? 'var(--green-500, #22c55e)' : '#2563eb',
                                                            label: rank === 0 ? 'Front-Runner' : `Rank ${rank + 1}`,
                                                            isWinner: rank === 0 && posTotalVotes > 0
                                                        }))).map((item, idx) => {
                                                            const isTop = item.isWinner;
                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    style={{
                                                                        background: isTop ? 'linear-gradient(90deg, #f0fdf4, #ffffff)' : '#fff',
                                                                        border: `1.5px solid ${isTop ? '#bbf7d0' : '#e2e8f0'}`,
                                                                        borderRadius: 14,
                                                                        padding: '12px 16px',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: 10,
                                                                        boxShadow: isTop ? '0 4px 12px rgba(34,197,94,0.02)' : 'none',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                            {/* Place badge */}
                                                                            <div style={{
                                                                                width: 26, height: 26, borderRadius: 8,
                                                                                background: isTop ? '#fef3c7' : '#f1f5f9',
                                                                                color: isTop ? '#92400e' : '#64748b',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                fontWeight: 800, fontSize: 11
                                                                            }}>
                                                                                {idx === 0 ? '🏆' : idx + 1}
                                                                            </div>

                                                                            {/* Avatar preview */}
                                                                            {item.avatar ? (
                                                                                <img src={api.getUrl(item.avatar)} alt={item.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5.px solid #cbd5e1' }} />
                                                                            ) : (
                                                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: item.name.includes('(NO)') ? '#ffeeec' : '#eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: item.name.includes('(NO)') ? '#ef4444' : 'inherit' }}>
                                                                                    {item.name.includes('(NO)') ? 'X' : item.name.split(' ').map(n => n[0]).join('')}
                                                                                </div>
                                                                            )}

                                                                            <div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{item.name}</span>
                                                                                    {isTop && (
                                                                                        <span style={{
                                                                                            fontSize: 8.5, fontWeight: 800, background: '#d97706',
                                                                                            color: '#fff', padding: '1.5px 5px', borderRadius: 4, textTransform: 'uppercase'
                                                                                        }}>
                                                                                            {item.label}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div style={{ fontSize: 10.5, color: '#64748b' }}>{item.dept}</div>
                                                                            </div>
                                                                        </div>

                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{item.votes} votes</strong>
                                                                            <div style={{ fontSize: 10.5, color: '#64748b' }}>{item.share}% share</div>
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                                                        <div style={{ height: '100%', width: `${item.share}%`, background: item.color }} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Visual Share Distribution Pie Chart */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fafafa', borderRadius: 14, padding: 16, border: '1px solid #f1f5f9', width: '100%' }}>
                                                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Vote Dispersion Tally</span>
                                                        <div style={{ width: '100%', height: 180 }}>
                                                            {posTotalVotes > 0 ? (
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={positionPieData}
                                                                            dataKey="value"
                                                                            nameKey="name"
                                                                            cx="50%"
                                                                            cy="40%"
                                                                            innerRadius={42}
                                                                            outerRadius={65}
                                                                            paddingAngle={2}
                                                                        >
                                                                            {positionPieData.map((part, i) => <Cell key={i} fill={part.color || COLORS[i % COLORS.length]} />)}
                                                                        </Pie>
                                                                        <Tooltip contentStyle={tooltipStyle} />
                                                                        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10.5, fontWeight: 600, bottom: 0 }} />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            ) : (
                                                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11.5, fontStyle: 'italic' }}>
                                                                    No votes recorded.
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

                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', border: '1.5px solid rgba(0,0,0,0.06)', borderRadius: 20 }}>
                        <Activity size={32} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                        <p style={{ color: '#64748b', fontSize: 13.5, fontStyle: 'italic' }}>Please select target campaign to initialize live tracking dashboard...</p>
                    </div>
                )}

            </div>

            {/* Ticker marquee css styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}} />
        </div>
    );
}
