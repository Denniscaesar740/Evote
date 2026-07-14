import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { Vote, Clock, CheckCircle, Check, Lock, Shield, ChevronRight, Users, AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Copy, Loader2 } from 'lucide-react';
import { StatusBadge, CountdownTimer, TrustBadge, ConfirmModal, Confetti } from '../components/SharedUI';

export default function VoterPortal() {
  const { user, markVoted } = useAuth();
  const { elections, getElectionCandidates, castVote, addToast, departments } = useElection();

  const [step, setStep]                         = useState(0); // 0=list, 1=review, 3=receipt
  const [selectedElection, setSelectedElection] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState({}); // maps position/category to candidate object
  const [confirmOpen, setConfirmOpen]           = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [receipt, setReceipt]                   = useState(null);
  const [confetti, setConfetti]                 = useState(false);
  const [showRulesModal, setShowRulesModal]     = useState(false);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  const eligibleElections = elections.filter(e =>
    e.status !== 'draft' && (!e.departmentId || e.departmentId === user?.departmentId)
  );
  const hasVoted = id => user?.hasVoted?.includes(id);

  const pickElection = el => {
    setSelectedElection(el);
    setSelectedCandidates({});
    setStep(1);
    setCurrentCategoryIndex(0);
    if (el.rules && el.rules.length) {
      setShowRulesModal(true);
    }
  };
  const reset        = () => { setStep(0); setSelectedElection(null); setSelectedCandidates({}); setReceipt(null); setShowRulesModal(false); setCurrentCategoryIndex(0); };

  const handleSelectElection = el => { pickElection(el); };

  const handleVote = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const candidateIds = Object.values(selectedCandidates).map(c => c.id);
      // Real blockchain call — awaited, returns receipt from server
      const result = await castVote(selectedElection.id, candidateIds, user?.departmentId);
      markVoted(selectedElection.id);
      const serverReceipt = result?.receipt;
      setReceipt({
        hash:         serverReceipt?.hash || '0x???',
        blockIndex:   serverReceipt?.blockIndex ?? '?',
        blockHash:    serverReceipt?.blockHash  || '',
        timestamp:    serverReceipt?.timestamp  || new Date().toISOString(),
        txId:         serverReceipt?.txId       || `TX-${Date.now().toString(36).toUpperCase()}`,
        electionTitle: selectedElection.title,
      });
      setStep(3);
      setConfetti(true);
      addToast({ type: 'success', title: 'Vote Cast!', message: 'Your ballot has been mined onto the blockchain.' });
      setTimeout(() => setConfetti(false), 4500);
    } catch (err) {
      addToast({ type: 'error', title: 'Vote Failed', message: err.message || 'Could not submit your vote. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Election List ── */
  if (step === 0) return (
    <div style={{ maxWidth: 820, margin: '0 auto' }} className="animate-fade-in">
      {confetti && <Confetti />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--navy-900)', marginBottom: 4 }}>
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--navy-400)', fontSize: 14 }}>
          You have <strong style={{ color: 'var(--accent-500)' }}>
            {eligibleElections.filter(e => e.status === 'active' && !hasVoted(e.id)).length}
          </strong> active election(s) awaiting your vote.
        </p>
      </div>

      {/* Trust banner */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-950), var(--navy-800))', borderRadius: 18, padding: '20px 24px', marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={22} style={{ color: 'var(--accent-400)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>Your Vote is Secure</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>All votes are anonymized, encrypted, and verifiable. You'll receive a unique receipt hash after voting.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TrustBadge type="secure" /><TrustBadge type="verified" />
        </div>
      </div>

      {/* Election cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {eligibleElections.map((el, i) => {
          const dept    = departments.find(d => d.id === el.departmentId);
          const voted   = hasVoted(el.id);
          const cands   = getElectionCandidates(el.id);
          const turnout = el.eligibleVoterCount > 0 ? Math.round((el.totalVotesCast / el.eligibleVoterCount) * 100) : 0;
          const clickable = el.status === 'active' && !voted;

          return (
            <div key={el.id} className={`election-card animate-fade-in ${voted ? 'voted' : ''} ${clickable ? 'clickable' : ''}`}
              style={{ animationDelay: `${i * 0.08}s` }}
              onClick={() => clickable && handleSelectElection(el)}
              role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
              onKeyDown={e => clickable && e.key === 'Enter' && handleSelectElection(el)}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <StatusBadge status={el.status} />
                    {dept
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', background: 'var(--navy-50)', padding: '2px 8px', borderRadius: 99 }}>{dept.name}</span>
                      : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple-600)', background: 'var(--purple-50)', padding: '2px 8px', borderRadius: 99 }}>Department of Computing and Data Analytics</span>
                    }
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 4 }}>{el.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--navy-400)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{el.description}</p>
                </div>
                {voted
                  ? <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--emerald-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle size={18} style={{ color: 'var(--emerald-500)' }} /></div>
                  : el.status === 'active' && <ChevronRight size={18} style={{ color: 'var(--navy-200)', marginTop: 4, flexShrink: 0 }} />
                }
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--navy-400)', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Users size={14} />{cands.length} Candidates</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Vote size={14} />{el.totalVotesCast}/{el.eligibleVoterCount} voted ({turnout}%)</span>
                {el.status === 'active' && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={14} /><CountdownTimer endTime={el.endTime} /></span>}
              </div>

              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${turnout}%`, background: voted ? 'var(--emerald-500)' : 'var(--accent-500)' }} />
              </div>
              {voted && <p style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--emerald-600)', fontSize: 13, fontWeight: 600 }}><CheckCircle size={14} />You have already voted in this election</p>}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Candidate Review ── */
  const candidates = selectedElection ? getElectionCandidates(selectedElection.id) : [];

  const categoriesToDisplay = selectedElection?.categories?.length
    ? selectedElection.categories
    : Array.from(new Set(candidates.map(c => c.position || 'General')));

  const activeCategories = categoriesToDisplay.filter(cat => candidates.some(c => c.position === cat));
  const allCategoriesSelected = activeCategories.every(cat => !!selectedCandidates[cat]);

  const currentCategory = activeCategories[currentCategoryIndex];
  const categoryCandidates = currentCategory ? candidates.filter(c => c.position === currentCategory) : [];

  if (step === 1) return (
    <div style={{ maxWidth: 820, margin: '0 auto' }} className="animate-fade-in">
      <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--navy-400)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 22, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Elections
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatusBadge status={selectedElection.status} />
          <CountdownTimer endTime={selectedElection.endTime} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy-900)', marginBottom: 4 }}>{selectedElection.title}</h1>
        <p style={{ fontSize: 14, color: 'var(--navy-400)' }}>{selectedElection.description}</p>
      </div>

      {/* Steps */}
      <div className="step-indicator">
        {['Review Candidates', 'Cast Vote', 'Receipt'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div className={`step-dot ${i === 0 ? 'active' : 'pending'}`}>{i + 1}</div>
            <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--navy-800)' : 'var(--navy-400)' }}>{s}</span>
            {i < 2 && <div className="step-line" />}
          </div>
        ))}
      </div>


      {/* Position Stepper Tabs */}
      {activeCategories.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 10,
          borderBottom: '1px solid var(--border)',
          scrollBehavior: 'smooth'
        }}>
          {activeCategories.map((cat, idx) => {
            const isCurrent = idx === currentCategoryIndex;
            const isSelected = !!selectedCandidates[cat];
            return (
              <button
                key={cat}
                onClick={() => setCurrentCategoryIndex(idx)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: `1.5px solid ${isCurrent ? 'var(--green-500)' : isSelected ? 'var(--green-200)' : 'var(--gray-200)'}`,
                  background: isCurrent ? 'var(--green-50)' : isSelected ? 'var(--green-50)' : 'var(--white)',
                  color: isCurrent ? 'var(--green-700)' : isSelected ? 'var(--green-600)' : 'var(--gray-500)',
                  fontWeight: isCurrent || isSelected ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {isSelected ? (
                  <CheckCircle size={14} style={{ color: 'var(--green-500)' }} />
                ) : (
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isCurrent ? 'var(--green-500)' : 'var(--gray-300)'
                  }} />
                )}
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Grouped Candidates List - Single Category View */}
      {!currentCategory ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--white)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <AlertTriangle size={36} style={{ color: 'var(--gold-500)', marginBottom: 12 }} />
          <p style={{ fontWeight: 700, color: 'var(--navy-900)' }}>No candidates available</p>
          <p style={{ fontSize: 13, color: 'var(--navy-400)', marginTop: 4 }}>There are no candidates registered for this election.</p>
        </div>
      ) : (
        <div key={currentCategory} style={{ marginBottom: 28 }} className="animate-fade-in">
          <div style={{
            borderLeft: '3.5px solid var(--accent-500)',
            paddingLeft: 12,
            marginBottom: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{currentCategory}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--navy-400)', marginTop: 2 }}>Please select one candidate for this position</p>
            </div>
            {activeCategories.length > 1 && (
              <div style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--green-700)',
                background: 'var(--green-50)',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--green-100)'
              }}>
                Position {currentCategoryIndex + 1} of {activeCategories.length}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {categoryCandidates.map((c, i) => {
              const sel = selectedCandidates[currentCategory]?.id === c.id;
              return (
                <div key={c.id} className={`candidate-card animate-fade-in ${sel ? 'selected' : ''}`}
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 20px',
                    cursor: 'pointer',
                    borderRadius: 16,
                    border: `2px solid ${sel ? 'var(--accent-500)' : 'var(--border)'}`,
                    background: sel ? 'linear-gradient(135deg, var(--green-50), #fff)' : 'var(--bg-white)',
                    boxShadow: sel ? '0 8px 30px rgba(46,125,50,0.08)' : '0 4px 12px rgba(0,0,0,0.02)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    aspectRatio: '1 / 1',
                  }}
                  onClick={() => setSelectedCandidates(p => ({ ...p, [currentCategory]: c }))} role="radio" aria-checked={sel} tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedCandidates(p => ({ ...p, [currentCategory]: c }))}>

                  {/* Radio Select Badge */}
                  <div style={{
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: `2px solid ${sel ? 'var(--accent-500)' : 'var(--navy-200)'}`,
                    background: sel ? 'var(--accent-500)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    zIndex: 10
                  }}>
                    {sel && <Check size={14} color="#fff" />}
                  </div>

                  {/* Candidate Image/Avatar */}
                  <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    {c.picture ? (
                      <img src={c.picture} alt={c.name} style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--white)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                    ) : (
                      <div style={{ width: 130, height: 130, borderRadius: '50%', background: `linear-gradient(135deg, ${c.color || 'var(--green-600)'}, ${c.color || 'var(--green-600)'}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 36, border: '3px solid var(--white)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                        {c.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                  </div>

                  {/* Candidate Details */}
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.department}</div>
                    <div style={{
                      background: 'var(--green-50)',
                      color: 'var(--green-800)',
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontSize: 10.5,
                      fontWeight: 700,
                      marginTop: 6,
                      display: 'inline-block'
                    }}>{c.position}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 32,
        paddingTop: 20,
        borderTop: '1px solid var(--border)'
      }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (currentCategoryIndex > 0) {
              setCurrentCategoryIndex(currentCategoryIndex - 1);
            } else {
              reset();
            }
          }}
        >
          <ArrowLeft size={16} />
          {currentCategoryIndex > 0 ? 'Previous Position' : 'Back to Elections'}
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          {currentCategoryIndex < activeCategories.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentCategoryIndex(currentCategoryIndex + 1)}
            >
              Next Position <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!allCategoriesSelected}
              onClick={() => setConfirmOpen(true)}
              style={{
                background: 'var(--accent-500)',
                borderColor: 'var(--accent-600)',
                color: 'var(--gray-900)'
              }}
            >
              <Vote size={16} /> Proceed to Vote
            </button>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      <ConfirmModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleVote}
        title="Confirm Your Vote" confirmText={submitting ? 'Submitting…' : 'Cast My Vote'}>
        {submitting
          ? <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Loader2 size={26} style={{ color: 'var(--accent-500)' }} className="animate-spin" />
              </div>
              <p style={{ fontWeight: 700, color: 'var(--navy-700)' }}>Encrypting and recording your vote…</p>
              <p style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 4 }}>Please do not close this window</p>
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <div style={{ background: 'var(--navy-50)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Your Selections</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(selectedCandidates).map(([category, candidate]) => (
                    <div key={category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy-900)' }}>{candidate.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--accent-500)', fontWeight: 700 }}>{category}</div>
                      </div>
                      {candidate.picture ? (
                        <img src={candidate.picture} alt={candidate.name} style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: 6, background: candidate.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>
                          {candidate.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-100)', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 8 }}>
                <AlertTriangle size={15} style={{ color: 'var(--amber-500)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--amber-700)' }}>This action is <strong>irreversible</strong>. Your vote cannot be changed once submitted.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--emerald-600)', fontSize: 12, fontWeight: 600 }}>
                <Lock size={13} />Your vote will be encrypted and anonymized
              </div>
            </div>
        }
      </ConfirmModal>

      {/* Election Rules Popup Modal */}
      {selectedElection && (
        <ConfirmModal 
          isOpen={showRulesModal} 
          onClose={() => { setShowRulesModal(false); reset(); }} 
          onConfirm={() => setShowRulesModal(false)}
          title="Election Rules"
          confirmText="I Agree & Proceed"
        >
          <div style={{ background: 'var(--amber-50)', border: '1.5px solid var(--amber-100)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 12, marginTop: 10 }}>
            <AlertTriangle size={18} style={{ color: 'var(--amber-500)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--amber-800)', marginBottom: 8 }}>Please review the voting guidelines for this election:</p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedElection.rules?.map((r, i) => (
                  <li key={i} style={{ fontSize: 13.5, color: 'var(--amber-700)', display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1.5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber-400)', flexShrink: 0, marginTop: 7 }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );

  /* ── Receipt ── */
  if (step === 3 && receipt) return (
    <div style={{ maxWidth: 480, margin: '0 auto' }} className="animate-vote-success">
      {confetti && <Confetti />}
      <div className="receipt-card">
        <div className="receipt-header">
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '2px solid rgba(255,255,255,0.3)' }}>
            <CheckCircle size={36} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Vote Cast Successfully!</h2>
          <p style={{ fontSize: 14, opacity: 0.8 }}>Your vote has been encrypted and recorded securely.</p>
        </div>

        <div style={{ padding: 24 }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Vote Receipt</p>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--navy-400)', marginBottom: 18 }}>Save this receipt for your records</p>

          <div style={{ background: 'var(--navy-50)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Election',       val: receipt.electionTitle,                         mono: false },
              { label: 'Block Index',    val: `#${receipt.blockIndex}`,                      mono: true  },
              { label: 'Transaction ID', val: receipt.txId,                                  mono: true  },
              { label: 'Vote Receipt',   val: receipt.hash.slice(0, 22) + '…',               mono: true  },
              { label: 'Block Hash',     val: receipt.blockHash ? receipt.blockHash.slice(0,16) + '…' : '—', mono: true },
              { label: 'Timestamp',      val: new Date(receipt.timestamp).toLocaleString(),   mono: false },
              { label: 'Status',         val: '✓ Verified & Recorded on Blockchain',          mono: false },
            ].map(({ label, val, mono }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--navy-400)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: mono ? 11 : 13, fontWeight: 700, color: 'var(--navy-800)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', textAlign: 'right', wordBreak: 'break-all', maxWidth: '60%' }}>{val}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            <TrustBadge type="secure" /><TrustBadge type="verified" />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }}
              onClick={() => { navigator.clipboard?.writeText(`Receipt: ${receipt.txId}\nHash: ${receipt.hash}`); addToast({ type: 'info', message: 'Receipt copied to clipboard' }); }}>
              <Copy size={14} />Copy Receipt
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={reset}>
              Back to Elections
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}
