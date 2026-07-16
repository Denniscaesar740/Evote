import { useState, useRef, useEffect } from 'react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSyncedDate } from '../utils/time';
import { LayoutDashboard, ClipboardList, Users, UserCheck, FileText, PieChart, Plus, Upload, ShieldCheck, ShieldAlert, FileDown, Clock, CheckCircle, Check, Settings, Calendar, UserPlus, Bell, Trash2, FileSpreadsheet, Download, AlertTriangle, Eye, X, Layers, Edit3 } from 'lucide-react';
import { StatCard, StatusBadge, CountdownTimer, ConfirmModal } from '../components/SharedUI';
import readXlsxFile from 'read-excel-file/browser';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'elections', label: 'Elections', icon: ClipboardList },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'voters', label: 'Voter Registry', icon: UserCheck },
  { id: 'users', label: 'Users', icon: UserPlus },
  { id: 'notices', label: 'Notices', icon: Bell },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'config', label: 'Settings', icon: Settings },
  { id: 'results', label: 'Results', icon: PieChart },
  { id: 'audit', label: 'Audit Log', icon: FileText },
];

const ROLE_COLORS = {
  Admin: { bg: 'var(--green-50)', color: 'var(--green-700)' },
  Auditor: { bg: 'var(--gold-50)', color: 'var(--gold-700)' },
  System: { bg: 'var(--gray-100)', color: 'var(--gray-600)' },
  Voter: { bg: 'var(--green-50)', color: 'var(--green-600)' },
};

export default function AdminPanel({ activeTab = 'dashboard', onNavigateTab }) {
  const { user } = useAuth();
  const { elections, candidates, auditLogs, departments, createElection, updateElection, addCandidate, updateCandidate, deleteCandidate, deleteElectionCategory, addToast, users = [], announcements = [], addUser, updateUser, deleteUser, importUsers, clearVoterRegistry, addAnnouncement, addElectionCategory } = useElection();
  const [tab, setTab] = useState(activeTab);

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCandModal, setShowCandModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  // Import Preview Modal State
  const [importPreview, setImportPreview] = useState(null); // { fileName, headers, mappedColumns, rows, warnings, validCount }
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importStats, setImportStats] = useState(null); // { count, fileName, timestamp }
  const [conflictResponse, setConflictResponse] = useState(null);

  const [addingCategory, setAddingCategory] = useState({});

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [newElec, setNewElec] = useState({ title: '', departmentId: '', type: 'Student Representative', startTime: '', endTime: '', description: '', eligibleVoterCount: 100, categories: [] });

  // Candidate State
  const [newCand, setNewCand] = useState({ electionId: '', name: '', position: '', color: '#2e7d32', picture: '', department: '', ballotNumber: '' });
  const [editingCand, setEditingCand] = useState(null);
  const [candSearch, setCandSearch] = useState('');
  const [candElFilter, setCandElFilter] = useState('all');
  const [candPosFilter, setCandPosFilter] = useState('all');
  const [elecFilter, setElecFilter] = useState('all');

  // Notice Board State
  const [newNotice, setNewNotice] = useState({ title: '', content: '', category: 'info', target: 'all' });

  // Config State
  const [config, setConfig] = useState({
    allowRevision: false,
    doubleSign: true,
    sessionTimeout: 15,
    mfaRequired: false,
    appName: 'UniVote ACSES-SRID eVoting',
  });

  // User Management States
  const [searchUser, setSearchUser] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [searchVoter, setSearchVoter] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', studentId: '', email: '', role: 'voter', departmentId: '', phoneNumber: '', year: '', password: '' });

  const [editingElection, setEditingElection] = useState(null);

  const activeCount = elections.filter(e => e.status === 'active').length;
  const totalVotes = elections.reduce((s, e) => s + e.totalVotesCast, 0);

  // Calculate average turnout across active and closed elections in real-time
  const completedOrActiveElections = elections.filter(e => e.status === 'active' || e.status === 'closed');
  const totalEligibleForTurnout = completedOrActiveElections.reduce((s, e) => s + e.eligibleVoterCount, 0);
  const totalVotesForTurnout = completedOrActiveElections.reduce((s, e) => s + e.totalVotesCast, 0);
  const turnout = totalEligibleForTurnout > 0 ? Math.round((totalVotesForTurnout / totalEligibleForTurnout) * 100) : 0;

  const voterUsers = users.filter(u => u.role === 'voter');

  const filteredVoters = voterUsers
    .filter(u => {
      const matchesSearch = !searchVoter ||
        u.name.toLowerCase().includes(searchVoter.toLowerCase()) ||
        u.studentId.toLowerCase().includes(searchVoter.toLowerCase()) ||
        u.email.toLowerCase().includes(searchVoter.toLowerCase());
      const matchesDept = filterDept === 'all' || u.departmentId === filterDept;
      const matchesYear = filterYear === 'all' || String(u.year || 'N/A') === filterYear;
      const matchesStatus = filterStatus === 'all' || String(u.status || 'active').toLowerCase() === filterStatus.toLowerCase();
      return matchesSearch && matchesDept && matchesYear && matchesStatus;
    })
    .sort((a, b) => {
      let valA, valB;
      if (sortField === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortField === 'studentId') {
        valA = a.studentId || '';
        valB = b.studentId || '';
      } else if (sortField === 'year') {
        valA = a.year || '';
        valB = b.year || '';
      } else if (sortField === 'department') {
        const deptA = departments.find(d => d.id === a.departmentId);
        const deptB = departments.find(d => d.id === b.departmentId);
        valA = deptA ? deptA.name : 'Department of Computing and Data Analytics';
        valB = deptB ? deptB.name : 'Department of Computing and Data Analytics';
      } else if (sortField === 'status') {
        valA = a.status || 'active';
        valB = b.status || 'active';
      } else {
        return 0;
      }
      const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return sortAsc ? comp : -comp;
    });

  const renderSortHeader = (field, label) => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => {
          if (isSorted) {
            setSortAsc(!sortAsc);
          } else {
            setSortField(field);
            setSortAsc(true);
          }
        }}
        style={{ cursor: 'pointer', userSelect: 'none', transition: 'background-color 0.2s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          <span style={{ fontSize: 10, color: isSorted ? 'var(--green-600)' : 'var(--navy-300)' }}>
            {isSorted ? (sortAsc ? '▲' : '▼') : '▲▼'}
          </span>
        </div>
      </th>
    );
  };

  const navigate = id => { setTab(id); onNavigateTab?.(id); };

  const formatDateTimeLocal = (dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && dateStr.length === 16 && dateStr.includes('T')) {
      return dateStr;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleUpdateElection = async () => {
    if (!editingElection.title || !editingElection.startTime || !editingElection.endTime) {
      addToast({ type: 'error', message: 'Fill all required fields.' });
      return;
    }
    try {
      await updateElection({
        id: editingElection.id,
        title: editingElection.title,
        description: editingElection.description,
        type: editingElection.type,
        departmentId: editingElection.departmentId || null,
        startTime: new Date(editingElection.startTime).toISOString(),
        endTime: new Date(editingElection.endTime).toISOString(),
        eligibleVoterCount: Number(editingElection.eligibleVoterCount),
      });
      addToast({ type: 'success', title: 'Election Updated', message: `Election "${editingElection.title}" updated successfully.` });
      setEditingElection(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err.message || 'Could not update election.' });
    }
  };

  const handleCreateElec = () => {
    if (!newElec.title || !newElec.startTime || !newElec.endTime) { addToast({ type: 'error', message: 'Fill all required fields.' }); return; }
    if (!newElec.categories || newElec.categories.length === 0) { addToast({ type: 'error', message: 'Define at least one ballot position.' }); return; }
    const electionId = `elec-${Date.now()}`;
    createElection({
      ...newElec,
      id: electionId,
      status: 'draft',
      totalVotesCast: 0,
      createdBy: user.name,
      startTime: new Date(newElec.startTime).toISOString(),
      endTime: new Date(newElec.endTime).toISOString()
    });

    addToast({ type: 'success', title: 'Election Created', message: `"${newElec.title}" saved as draft.` });
    setShowCreateModal(false);
    setNewElec({ title: '', departmentId: '', type: 'Student Representative', startTime: '', endTime: '', description: '', eligibleVoterCount: 100, categories: [] });
    setWizardStep(1);
  };

  const handleWizardNext = () => {
    if (wizardStep < 4) {
      if (wizardStep === 1 && !newElec.title) { addToast({ type: 'error', message: 'Title is required.' }); return; }
      if (wizardStep === 2 && (!newElec.categories || newElec.categories.length === 0)) { addToast({ type: 'error', message: 'At least one ballot position is required.' }); return; }
      setWizardStep(p => p + 1);
    } else {
      handleCreateElec();
    }
  };

  const handlePublish = id => {
    const cands = candidates.filter(c => c.electionId === id);
    if (!cands.length) { addToast({ type: 'warning', title: 'Cannot Publish', message: 'Add at least one candidate first.' }); return; }
    updateElection({ id, status: 'active', updatedBy: user.name });
    addToast({ type: 'success', title: 'Published', message: 'Election is now active.' });
  };

  const handleClose = id => {
    updateElection({ id, status: 'closed', updatedBy: user.name });
    addToast({ type: 'success', title: 'Closed', message: 'Election has been closed.' });
  };

  const handleAddCand = async () => {
    if (!newCand.electionId || !newCand.name || !newCand.position) { addToast({ type: 'error', message: 'Fill all candidate fields.' }); return; }
    const targetEl = elections.find(e => e.id === newCand.electionId);
    const deptName = newCand.department || (targetEl?.departmentId ? (departments.find(d => d.id === targetEl.departmentId)?.name || '') : 'Department of Computing and Data Analytics');
    try {
      await addCandidate({ ...newCand, id: `cand-${Date.now()}`, department: deptName, voteCount: 0 });
      addToast({ type: 'success', title: 'Candidate Registered', message: `${newCand.name} successfully registered.` });
      setShowCandModal(false);
      setNewCand({ electionId: '', name: '', position: '', color: '#2e7d32', picture: '', department: '', ballotNumber: '' });
    } catch (err) {
      addToast({ type: 'error', title: 'Creation Failed', message: err.message || 'Could not register candidate.' });
    }
  };

  const handleUpdateCand = async () => {
    if (!editingCand.electionId || !editingCand.name || !editingCand.position) {
      addToast({ type: 'error', message: 'Fill all candidate fields.' });
      return;
    }
    const targetEl = elections.find(e => e.id === editingCand.electionId);
    const deptName = editingCand.department || (targetEl?.departmentId ? (departments.find(d => d.id === targetEl.departmentId)?.name || '') : 'Department of Computing and Data Analytics');
    try {
      await updateCandidate(editingCand.id, {
        name: editingCand.name,
        electionId: editingCand.electionId,
        position: editingCand.position,
        department: deptName,
        manifesto: editingCand.manifesto || '',
        color: editingCand.color || '#2e7d32',
        picture: editingCand.picture,
        ballotNumber: editingCand.ballotNumber || null
      });
      addToast({ type: 'success', title: 'Candidate Updated', message: `${editingCand.name} information updated.` });
      setShowCandModal(false);
      setEditingCand(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err.message || 'Could not update candidate.' });
    }
  };

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewCand(p => ({ ...p, picture: reader.result }));
    };
    reader.readAsDataURL(file);
  };



  const handleAddNotice = (e) => {
    e.preventDefault();
    if (!newNotice.title || !newNotice.content) { addToast({ type: 'error', message: 'Provide title and content.' }); return; }
    addAnnouncement({
      ...newNotice,
      id: `ann-${Date.now()}`,
      timestamp: getSyncedDate().toISOString(),
    });
    addToast({ type: 'success', title: 'Notice Posted', message: 'Announcement has been broadcast.' });
    setNewNotice({ title: '', content: '', category: 'info', target: 'all' });
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.studentId || !newUser.email) {
      addToast({ type: 'error', message: 'Fill all required fields.' });
      return;
    }
    if ((newUser.role === 'admin' || newUser.role === 'auditor') && !newUser.password) {
      addToast({ type: 'error', message: 'Assigned login password is required for admin/auditor accounts.' });
      return;
    }
    try {
      await addUser({ ...newUser, id: `user-${Date.now()}`, hasVoted: [], status: 'active' });
      addToast({ type: 'success', title: 'User Registered', message: `${newUser.name} added successfully.` });
      setShowAddUserModal(false);
      setNewUser({ name: '', studentId: '', email: '', role: 'voter', departmentId: '', phoneNumber: '', year: '', password: '' });
    } catch (err) {
      addToast({ type: 'error', title: 'Registration Failed', message: err.message || 'System failed to add new user record.' });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser.name || !editingUser.studentId || !editingUser.email) {
      addToast({ type: 'error', message: 'Fill all required fields.' });
      return;
    }
    try {
      await updateUser({
        id: editingUser.id,
        name: editingUser.name,
        studentId: editingUser.studentId,
        email: editingUser.email,
        phoneNumber: editingUser.phoneNumber,
        year: editingUser.year,
        role: editingUser.role,
        departmentId: editingUser.departmentId || null,
        status: editingUser.status,
        otpCount: editingUser.otpCount !== undefined ? editingUser.otpCount : null
      });
      addToast({ type: 'success', title: 'User Updated', message: `User "${editingUser.name}" details updated successfully.` });
      setEditingUser(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err.message || 'Could not update user.' });
    }
  };

  // ─── CSV Parser ───
  const parseCSV = (csvText) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') { row[row.length - 1] += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') { i++; }
        lines.push(row); row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") lines.push(row);
    return lines;
  };

  // ─── Read file and build preview ───
  const handleCSV = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    setCsvFile(f);
    readFileForPreview(f);
    if (e.target) e.target.value = ''; // allow re-upload of same file
  };

  const readFileForPreview = (f) => {
    const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');
    if (isExcel) {
      readXlsxFile(f)
        .then((rows) => {
          buildPreview(rows, f.name);
        })
        .catch((err) => {
          addToast({ type: 'error', title: 'Parse Error', message: err.message || 'Could not parse Excel file.' });
        });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          buildPreview(parseCSV(event.target.result), f.name);
        } catch (err) {
          addToast({ type: 'error', title: 'Parse Error', message: err.message || 'Could not parse CSV.' });
        }
      };
      reader.onerror = () => addToast({ type: 'error', title: 'Read Error', message: 'Could not read file.' });
      reader.readAsText(f);
    }
  };

  const buildPreview = (rows, fileName) => {
    const cleanRows = rows.filter(r => r && r.some(cell => String(cell || '').trim() !== ''));
    if (cleanRows.length <= 1) {
      addToast({ type: 'error', title: 'Import Failed', message: 'File is empty or has no data rows.' });
      return;
    }
    const headers = cleanRows[0].map(h => String(h || '').trim().toLowerCase().replace(/^["']|["']$/g, ''));
    const rawHeaders = cleanRows[0].map(h => String(h || '').trim());

    const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'student name');
    const idIdx = headers.findIndex(h => h.includes('reference') || h.includes('ref') || h.includes('student') || h.includes('index'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
    const yearIdx = headers.findIndex(h => h.includes('year') || h.includes('level') || h.includes('class'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tele') || h.includes('mobile') || h.includes('contact'));
    const deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept') || h.includes('faculty') || h.includes('programme') || h.includes('program'));

    if (nameIdx === -1 || idIdx === -1 || emailIdx === -1) {
      addToast({ type: 'error', title: 'Missing Columns', message: 'File must have Name, Student/Reference ID, and Email columns.' });
      return;
    }

    const mappedColumns = {
      name: { index: nameIdx, header: rawHeaders[nameIdx], label: 'Name' },
      studentId: { index: idIdx, header: rawHeaders[idIdx], label: 'Student/Ref ID' },
      email: { index: emailIdx, header: rawHeaders[emailIdx], label: 'Email' },
      ...(yearIdx !== -1 && { year: { index: yearIdx, header: rawHeaders[yearIdx], label: 'Year/Level' } }),
      ...(phoneIdx !== -1 && { phone: { index: phoneIdx, header: rawHeaders[phoneIdx], label: 'Phone' } }),
      ...(deptIdx !== -1 && { department: { index: deptIdx, header: rawHeaders[deptIdx], label: 'Department' } }),
    };

    const parsedRows = [];
    const warnings = [];
    for (let i = 1; i < cleanRows.length; i++) {
      const row = cleanRows[i];
      if (!row || row.length <= Math.max(nameIdx, idIdx, emailIdx)) continue;
      const name = String(row[nameIdx] || '').trim();
      const studentId = String(row[idIdx] || '').trim();
      const email = String(row[emailIdx] || '').trim();
      const year = yearIdx !== -1 ? String(row[yearIdx] || '').trim() : '';
      let phone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
      if (phone && /^\d{9,10}$/.test(phone) && !phone.startsWith('0')) phone = '0' + phone;
      const department = deptIdx !== -1 ? String(row[deptIdx] || '').trim() : '';

      const missing = [];
      if (!name) missing.push('name');
      if (!studentId) missing.push('ID');
      if (!email) missing.push('email');
      if (missing.length) { warnings.push(`Row ${i}: missing ${missing.join(', ')}`); continue; }
      if (email && !email.includes('@')) warnings.push(`Row ${i}: "${email}" may not be a valid email`);

      parsedRows.push({ name, studentId, email, year, phone, department, role: 'voter' });
    }

    setImportPreview({ fileName, mappedColumns, rows: parsedRows, warnings, validCount: parsedRows.length, totalDataRows: cleanRows.length - 1 });
    setShowImportPreview(true);
  };

  // ─── Confirm import from preview ───
  const handleConfirmImport = async () => {
    if (!importPreview?.rows?.length) return;
    setImporting(true);
    try {
      const res = await importUsers(importPreview.rows);
      setImportStats({ count: res.count, fileName: importPreview.fileName, timestamp: getSyncedDate().toISOString() });
      addToast({ type: 'success', title: 'Imported Successfully', message: `${res.count} voters imported from ${importPreview.fileName}.` });
      setShowImportPreview(false);
      setImportPreview(null);
    } catch (err) {
      if (err.message === 'import_conflicts' && err.data?.conflicts) {
        setConflictResponse({ conflicts: err.data.conflicts });
      } else {
        addToast({ type: 'error', title: 'Import Failed', message: err.message || 'Error importing voters.' });
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImportWithStrategy = async (strategy) => {
    if (!importPreview?.rows?.length) return;
    setImporting(true);
    setConflictResponse(null);
    try {
      const res = await importUsers(importPreview.rows, strategy);
      setImportStats({ count: res.count, fileName: importPreview.fileName, timestamp: getSyncedDate().toISOString() });
      addToast({
        type: 'success',
        title: 'Imported Successfully',
        message: `${res.count} voters imported with '${strategy}' strategy.`
      });
      setShowImportPreview(false);
      setImportPreview(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Import Failed', message: err.message || 'Error importing voters.' });
    } finally {
      setImporting(false);
    }
  };

  const handleClearRegistry = async (year) => {
    const isYearSpecific = year && year !== 'all';
    const confirmMsg = isYearSpecific
      ? `WARNING: Are you sure you want to clear the voter registry for ${year}? This will permanently delete ALL registered student voters in ${year}. This action cannot be undone.`
      : "WARNING: Are you sure you want to clear the entire voter registry? This will permanently delete ALL registered student voters. This action cannot be undone.";

    if (!window.confirm(confirmMsg)) {
      return;
    }
    const password = window.prompt("This is a highly destructive action. Please enter your administrator password to confirm:");
    if (!password) {
      addToast({ type: 'warning', message: 'Clear cancelled. Confirmation password is required.' });
      return;
    }
    try {
      const res = await clearVoterRegistry(isYearSpecific ? year : undefined, password);
      addToast({ type: 'success', title: 'Registry Cleared', message: res.message || 'Voters deleted successfully.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Clear Failed', message: err.message || 'Failed to clear voter registry.' });
    }
  };

  // ─── Drag and drop handlers ───
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      addToast({ type: 'error', title: 'Invalid File', message: 'Please drop a .csv, .xlsx, or .xls file.' });
      return;
    }
    setCsvFile(f);
    readFileForPreview(f);
  };

  // ─── Download template ───
  const downloadTemplate = () => {
    const headers = 'Name,Student ID / Reference Number,Email,Phone Number,Year / Level,Department / Programme';
    const sample1 = 'Kwame Asante,UMaT/CSE/22/001,kwame.asante@umat.edu.gh,0244000000,Year 2,Computer Science & Engineering';
    const sample2 = 'Ama Mensah,UMaT/MIN/23/015,ama.mensah@umat.edu.gh,0550123456,Year 1,Mining Engineering';
    const csv = [headers, sample1, sample2].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'univote_voter_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'info', title: 'Template Downloaded', message: 'Fill in the template and upload it to import voters.' });
  };

  const inp = (label, value, onChange, opts = {}) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</label>
      {opts.textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={opts.placeholder} className="form-input" style={{ height: 76, resize: 'none', ...opts.style }} disabled={opts.disabled} />
        : opts.select
          ? <select value={value} onChange={e => onChange(e.target.value)} className="form-input" disabled={opts.disabled} style={opts.style}>{opts.select}</select>
          : <input type={opts.type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={opts.placeholder} className={`form-input${opts.mono ? ' form-input-mono' : ''}`} required={opts.required} disabled={opts.disabled} style={opts.style} />
      }
    </div>
  );

  return (
    <div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          <div style={{ paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 26, background: 'var(--gold-500)', borderRadius: 4 }} />
              Administrator Overview
            </h1>
            <p style={{ fontSize: 13, color: 'var(--navy-400)', marginTop: 4, marginLeft: 18 }}>System telemetry and election operations at a glance.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #ffffff, #f9fafb)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px -5px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -15, right: -15, background: 'var(--green-50)', width: 80, height: 80, borderRadius: '50%', opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--green-100)', color: 'var(--green-700)', padding: 10, borderRadius: 10 }}><ClipboardList size={22} /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All Elections</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy-900)' }}>{elections.length}</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #ffffff, #f9fafb)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px -5px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -15, right: -15, background: '#dcfce7', width: 80, height: 80, borderRadius: '50%', opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--green-600)', color: '#fff', padding: 10, borderRadius: 10, boxShadow: '0 4px 12px rgba(37, 99, 38, 0.3)' }}><Clock size={22} /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Polls</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--green-600)' }}>{activeCount}</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #ffffff, #f9fafb)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px -5px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -15, right: -15, background: 'var(--gold-50)', width: 80, height: 80, borderRadius: '50%', opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--gold-500)', color: '#fff', padding: 10, borderRadius: 10, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}><CheckCircle size={22} /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Votes Cast</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy-900)' }}>{totalVotes.toLocaleString()}</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #ffffff, #f9fafb)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px -5px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -15, right: -15, background: 'var(--gray-100)', width: 80, height: 80, borderRadius: '50%', opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--navy-700)', color: '#fff', padding: 10, borderRadius: 10 }}><PieChart size={22} /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Turnout</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy-900)' }}>{turnout}%</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
            <div className="card card-padded" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy-900)' }}>Active Elections Engine</h3>
                <div style={{ background: 'var(--green-50)', color: 'var(--green-700)', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, background: 'var(--green-500)', borderRadius: '50%' }} className="animate-pulse-slow" /> Real-time
                </div>
              </div>
              {elections.filter(e => e.status === 'active').map(el => (
                <div key={el.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-300)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'} onClick={() => { setElecFilter('active'); setTab('elections'); }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy-900)', marginBottom: 4 }}>{el.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--navy-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={13} /> {departments.find(d => d.id === el.departmentId)?.name || 'General / Campus-wide'}
                    </div>
                  </div>
                  <CountdownTimer endTime={el.endTime} />
                </div>
              ))}
              {!elections.filter(e => e.status === 'active').length && (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--gray-50)', borderRadius: 12, border: '1px dashed var(--gray-300)' }}>
                  <Clock size={32} color="var(--gray-400)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--navy-500)', fontSize: 14, fontWeight: 500 }}>No polls are currently running.</p>
                </div>
              )}
            </div>

            <div style={{ background: 'linear-gradient(145deg, var(--green-950), var(--green-800))', borderRadius: 16, padding: '28px 24px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
              <div style={{ position: 'absolute', top: -50, right: -50, background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)', width: 200, height: 200, pointerEvents: 'none' }} />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Quick Console</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>Frequent portal operations</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Create New Election', action: () => { setWizardStep(1); setShowCreateModal(true); }, color: 'var(--gold-400)', icon: ClipboardList },
                  { label: 'Register Candidate', action: () => setShowCandModal(true), color: '#a5d6a7', icon: UserPlus },
                  { label: 'Import Voter Roster', action: () => fileRef.current?.click(), color: '#c8e6c9', icon: Upload },
                ].map((a, idx) => (
                  <button key={a.label} onClick={a.action} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8 }}><a.icon size={16} style={{ color: a.color }} /></div>
                    {a.label}
                    <Plus size={14} style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }} />
                  </button>
                ))}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCSV} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── ELECTIONS ── */}
      {tab === 'elections' && (() => {
        const draftEls = elections.filter(e => e.status === 'draft');
        const activeEls = elections.filter(e => e.status === 'active');
        const closedEls = elections.filter(e => e.status === 'closed');

        const filteredElections = elecFilter === 'all' ? elections
          : elecFilter === 'draft' ? draftEls
            : elecFilter === 'active' ? activeEls
              : closedEls;

        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--navy-900)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--green-500), var(--green-700))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={20} color="#fff" />
                  </div>
                  Election Management
                </h2>
                <p style={{ fontSize: 13, color: 'var(--navy-400)', marginLeft: 50 }}>
                  Manage {elections.length} election{elections.length !== 1 ? 's' : ''} — create ballots, define positions, and register aspirants.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => { setWizardStep(1); setShowCreateModal(true); }} style={{ borderRadius: 10, padding: '10px 20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(46,125,50,0.25)' }}>
                <Plus size={16} /> Create New Election
              </button>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Elections', value: elections.length, bg: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', accent: 'var(--green-700)' },
                { label: 'Draft', value: draftEls.length, bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', accent: 'var(--gold-600)' },
                { label: 'Active Now', value: activeEls.length, bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', accent: 'var(--green-600)' },
                { label: 'Closed', value: closedEls.length, bg: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', accent: 'var(--gray-600)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: s.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy-900)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--gray-100)', borderRadius: 10, padding: 3 }}>
              {[
                { key: 'all', label: 'All Elections', count: elections.length },
                { key: 'draft', label: 'Draft', count: draftEls.length },
                { key: 'active', label: 'Active', count: activeEls.length },
                { key: 'closed', label: 'Closed', count: closedEls.length },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setElecFilter(f.key)}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none',
                    background: elecFilter === f.key ? 'var(--white)' : 'transparent',
                    boxShadow: elecFilter === f.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    fontWeight: elecFilter === f.key ? 700 : 500,
                    color: elecFilter === f.key ? 'var(--green-700)' : 'var(--gray-500)',
                    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {f.label}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: elecFilter === f.key ? 'var(--green-50)' : 'var(--gray-200)', color: elecFilter === f.key ? 'var(--green-700)' : 'var(--gray-500)' }}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Election Cards */}
            {filteredElections.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredElections.map(el => {
                  const elCands = candidates.filter(c => c.electionId === el.id);
                  const totalVotesEl = elCands.reduce((a, c) => a + (c.voteCount || 0), 0);
                  const turnoutPct = el.eligibleVoterCount > 0 ? Math.min(100, Math.round((totalVotesEl / (el.eligibleVoterCount * (el.categories?.length || 1))) * 100)) : 0;
                  const isActive = el.status === 'active';
                  const isDraft = el.status === 'draft';
                  const isClosed = el.status === 'closed';
                  const dept = departments.find(d => d.id === el.departmentId);

                  return (
                    <div key={el.id} style={{ background: 'var(--white)', border: `1.5px solid ${isActive ? 'var(--green-200)' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden', boxShadow: isActive ? '0 4px 20px rgba(46,125,50,0.06)' : '0 1px 4px rgba(0,0,0,0.03)', transition: 'all 0.2s' }}>
                      {/* Card Top Accent */}
                      <div style={{ height: 4, background: isActive ? 'linear-gradient(90deg, var(--green-400), var(--green-600))' : isDraft ? 'linear-gradient(90deg, var(--gold-400), var(--gold-600))' : 'var(--gray-300)' }} />

                      {/* Card Header */}
                      <div style={{ padding: '20px 24px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <StatusBadge status={el.status} />
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--navy-300)', fontWeight: 700, letterSpacing: '0.02em' }}>{el.id}</span>
                              {isActive && <CountdownTimer endTime={el.endTime} />}
                            </div>
                            <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--navy-900)', marginBottom: 4 }}>{el.title}</h3>
                            <p style={{ fontSize: 12.5, color: 'var(--navy-500)', lineHeight: 1.55, marginBottom: 0 }}>{el.description || 'No description provided.'}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {isDraft && <button className="btn btn-primary btn-sm" onClick={() => handlePublish(el.id)} style={{ borderRadius: 8, fontWeight: 700 }}>Publish Poll</button>}
                            {isActive && <button className="btn btn-sm" onClick={() => handleClose(el.id)} style={{ borderRadius: 8, fontWeight: 700, background: 'var(--red-50)', color: 'var(--red-600)', border: '1.5px solid var(--red-100)' }}>Close Poll</button>}
                            {isClosed && new Date(el.endTime) > getSyncedDate() && <button className="btn btn-primary btn-sm" onClick={() => handlePublish(el.id)} style={{ borderRadius: 8, fontWeight: 700 }}>Publish Poll</button>}
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingElection(el)} style={{ borderRadius: 8 }}>Edit</button>
                          </div>
                        </div>

                        {/* Info Row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 14, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                          {[
                            { icon: '📅', label: 'Starts', value: new Date(el.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                            { icon: '🏁', label: 'Ends', value: new Date(el.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                            { icon: '🏛️', label: 'Department', value: dept?.name || 'Computing & Data Analytics' },
                            { icon: '👥', label: 'Eligible Voters', value: el.eligibleVoterCount },
                            { icon: '📊', label: 'Positions', value: (el.categories || []).length },
                            { icon: '🎓', label: 'Aspirants', value: elCands.length },
                          ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14 }}>{item.icon}</span>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-800)' }}>{item.value}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Turnout Progress (for active/closed) */}
                        {(isActive || isClosed) && (
                          <div style={{ padding: '12px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Voter Turnout</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: isActive ? 'var(--green-600)' : 'var(--navy-600)' }}>{turnoutPct}%</span>
                            </div>
                            <div className="progress-bar-track" style={{ height: 8, borderRadius: 99 }}>
                              <div className="progress-bar-fill" style={{ width: `${turnoutPct}%`, background: isActive ? 'linear-gradient(90deg, var(--green-400), var(--green-600))' : 'var(--gray-400)', borderRadius: 99 }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Positions & Aspirants Section */}
                      <div style={{ padding: '16px 24px 20px', background: 'var(--gray-50)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--navy-600)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Ballot Positions & Aspirants</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="text"
                              placeholder="Add new position…"
                              value={addingCategory[el.id] || ''}
                              onChange={e => setAddingCategory(p => ({ ...p, [el.id]: e.target.value }))}
                              className="form-input"
                              style={{ width: 160, height: 30, padding: '4px 10px', fontSize: 12, borderRadius: 8 }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault(); e.stopPropagation();
                                  const cat = addingCategory[el.id]?.trim();
                                  if (!cat) return;
                                  if (el.categories?.some(c => c.toLowerCase() === cat.toLowerCase())) {
                                    addToast({ type: 'warning', title: 'Duplicate', message: `"${cat}" exists.` }); return;
                                  }
                                  addElectionCategory(el.id, cat);
                                  setAddingCategory(p => ({ ...p, [el.id]: '' }));
                                  addToast({ type: 'success', title: 'Added', message: `"${cat}" position created.` });
                                }
                              }}
                            />
                            <button type="button" className="btn btn-primary btn-sm" style={{ height: 30, borderRadius: 8, fontSize: 12 }} onClick={e => {
                              e.preventDefault(); e.stopPropagation();
                              const cat = addingCategory[el.id]?.trim();
                              if (!cat) return;
                              if (el.categories?.some(c => c.toLowerCase() === cat.toLowerCase())) {
                                addToast({ type: 'warning', title: 'Duplicate', message: `"${cat}" exists.` }); return;
                              }
                              addElectionCategory(el.id, cat);
                              setAddingCategory(p => ({ ...p, [el.id]: '' }));
                              addToast({ type: 'success', title: 'Added', message: `"${cat}" position created.` });
                            }}>
                              <Plus size={13} /> Add
                            </button>
                          </div>
                        </div>

                        {(el.categories || []).length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                            {el.categories.map(cat => {
                              const catCands = candidates.filter(c => c.electionId === el.id && c.position === cat);
                              return (
                                <div key={cat} style={{ background: 'var(--white)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--white)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--green-500), var(--green-700))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 900 }}>{cat[0]}</div>
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{cat}</div>
                                        <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{catCands.length} aspirant{catCands.length !== 1 ? 's' : ''}</div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <button className="btn btn-sm" style={{ height: 24, padding: '0 8px', fontSize: 10, borderRadius: 6, border: '1px solid var(--green-200)', background: 'var(--green-50)', color: 'var(--green-700)' }} onClick={() => { setNewCand({ electionId: el.id, name: '', position: cat, color: '#2e7d32', picture: '', department: '' }); setShowCandModal(true); }}>
                                        <Plus size={10} /> Add
                                      </button>
                                      <button title="Delete" onClick={() => { if (window.confirm(`Delete "${cat}" position and all its candidates?`)) { deleteElectionCategory(el.id, cat); addToast({ type: 'success', message: `"${cat}" removed.` }); } }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--red-100)', background: 'var(--red-50)', color: 'var(--red-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                  <div style={{ padding: catCands.length ? '8px 10px' : '12px 10px' }}>
                                    {catCands.map(c => (
                                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, marginBottom: 4, transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          {c.picture ? (
                                            <img src={api.getUrl(c.picture)} alt={c.name} style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover', border: '1.5px solid var(--green-100)' }} />
                                          ) : (
                                            <div style={{ width: 28, height: 28, borderRadius: 7, background: c.color || 'var(--green-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>{c.name.split(' ').map(n => n[0]).join('')}</div>
                                          )}
                                          <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-900)' }}>{c.name}</div>
                                            <div style={{ fontSize: 9.5, color: 'var(--gray-400)' }}>{c.department || 'Computing & Data Analytics'}</div>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--green-50)', color: 'var(--green-800)', border: '1px solid var(--green-200)', padding: '2px 4px', borderRadius: 6 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700 }}>No.</span>
                                            <input
                                              type="number"
                                              defaultValue={c.ballotNumber || ''}
                                              onBlur={(e) => {
                                                const val = e.target.value;
                                                if (val !== (c.ballotNumber || '')) {
                                                  updateCandidate(c.id, { ...c, ballotNumber: val });
                                                  addToast({ type: 'success', message: `Ballot number updated` });
                                                }
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') e.target.blur();
                                              }}
                                              placeholder="-"
                                              style={{ width: 30, height: 16, fontSize: 10, fontWeight: 700, textAlign: 'center', border: 'none', background: 'var(--white)', borderRadius: 3, outline: 'none' }}
                                            />
                                          </div>
                                          <button title="Remove" onClick={() => { if (window.confirm(`Remove "${c.name}"?`)) { deleteCandidate(c.id); addToast({ type: 'success', message: `${c.name} removed.` }); } }} style={{ opacity: 0.4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red-500)', padding: 2 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    {!catCands.length && <div style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>No aspirants yet</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '20px 12px', border: '1.5px dashed var(--border)', borderRadius: 12, color: 'var(--gray-400)', fontSize: 12 }}>
                            No positions defined yet. Add positions above to start building the ballot structure.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--white)', borderRadius: 16, border: '1.5px dashed var(--border)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--green-50)', border: '1px solid var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <ClipboardList size={28} style={{ color: 'var(--green-300)' }} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-700)', marginBottom: 6 }}>
                  {elecFilter !== 'all' ? `No ${elecFilter} elections found` : 'No Elections Created Yet'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--navy-400)', maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.6 }}>
                  {elecFilter !== 'all' ? 'Try selecting a different status filter.' : 'Create your first election to define positions and register candidates for the ballot.'}
                </p>
                {elecFilter === 'all' && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setWizardStep(1); setShowCreateModal(true); }} style={{ borderRadius: 8 }}>
                    <Plus size={14} /> Create First Election
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── CANDIDATES ── */}
      {tab === 'candidates' && (() => {
        const allPositions = Array.from(new Set(candidates.map(c => c.position).filter(Boolean)));

        const filteredCands = candidates.filter(c => {
          const matchesSearch = !candSearch ||
            c.name.toLowerCase().includes(candSearch.toLowerCase()) ||
            c.department?.toLowerCase().includes(candSearch.toLowerCase());
          const matchesElection = candElFilter === 'all' || c.electionId === candElFilter;
          const matchesPosition = candPosFilter === 'all' || c.position === candPosFilter;
          return matchesSearch && matchesElection && matchesPosition;
        });

        // Group by position
        const positionGroups = {};
        filteredCands.forEach(c => {
          const pos = c.position || 'Uncategorized';
          if (!positionGroups[pos]) positionGroups[pos] = [];
          positionGroups[pos].push(c);
        });

        // Sort each position lane by ballotNumber ascending
        Object.keys(positionGroups).forEach(pos => {
          positionGroups[pos].sort((a, b) => {
            const numA = a.ballotNumber ? Number(a.ballotNumber) : Infinity;
            const numB = b.ballotNumber ? Number(b.ballotNumber) : Infinity;
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
          });
        });

        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--navy-900)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--green-500), var(--green-700))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={20} color="#fff" />
                  </div>
                  Candidate Registry
                </h2>
                <p style={{ fontSize: 13, color: 'var(--navy-400)', marginLeft: 50 }}>
                  {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} registered across {elections.length} election{elections.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCandModal(true)} style={{ borderRadius: 10, padding: '10px 20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(46,125,50,0.25)' }}>
                <Plus size={16} /> Register New Candidate
              </button>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Candidates', value: candidates.length, gradient: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', iconBg: 'var(--green-500)' },
                { label: 'Positions', value: allPositions.length, gradient: 'linear-gradient(135deg, #fffbeb, #fef3c7)', iconBg: 'var(--gold-500)' },
                { label: 'Active Elections', value: elections.filter(e => e.status === 'active').length, gradient: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', iconBg: 'var(--green-600)' },
                { label: 'Draft Elections', value: elections.filter(e => e.status === 'draft').length, gradient: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', iconBg: 'var(--gray-500)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.gradient, borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--navy-900)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="cand-filter-bar">
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={candSearch} onChange={e => setCandSearch(e.target.value)} placeholder="Search candidates by name or department..." className="form-input" style={{ paddingLeft: 33, border: 'none', background: 'transparent', boxShadow: 'none' }} />
              </div>
              <div style={{ height: 24, width: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-400)', whiteSpace: 'nowrap' }}>ELECTION:</span>
              <button className={`filter-chip ${candElFilter === 'all' ? 'active' : ''}`} onClick={() => setCandElFilter('all')}>All</button>
              {elections.slice(0, 4).map(e => (
                <button key={e.id} className={`filter-chip ${candElFilter === e.id ? 'active' : ''}`} onClick={() => setCandElFilter(e.id)}>
                  {e.title.length > 20 ? e.title.slice(0, 20) + '…' : e.title}
                </button>
              ))}
            </div>

            {/* Position Filter Pills */}
            {allPositions.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Position:</span>
                <button onClick={() => setCandPosFilter('all')} style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, border: `1.5px solid ${candPosFilter === 'all' ? 'var(--green-500)' : 'var(--border)'}`, background: candPosFilter === 'all' ? 'var(--green-500)' : 'var(--white)', color: candPosFilter === 'all' ? '#fff' : 'var(--gray-600)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  All Positions
                </button>
                {allPositions.map(pos => (
                  <button key={pos} onClick={() => setCandPosFilter(pos)} style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, border: `1.5px solid ${candPosFilter === pos ? 'var(--green-500)' : 'var(--border)'}`, background: candPosFilter === pos ? 'var(--green-500)' : 'var(--white)', color: candPosFilter === pos ? '#fff' : 'var(--gray-600)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {pos}
                  </button>
                ))}
              </div>
            )}

            {/* Position Board */}
            {Object.keys(positionGroups).length > 0 ? (
              <div className="position-board">
                {Object.entries(positionGroups).map(([pos, cands], idx) => (
                  <div key={pos} className="position-lane">
                    <div className="position-lane-header">
                      <div className="position-lane-title">
                        <div className="position-icon">{pos[0]}</div>
                        <div>
                          <h4 style={{ margin: 0 }}>{pos}</h4>
                          <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 500 }}>
                            {cands.length} candidate{cands.length !== 1 ? 's' : ''} registered
                          </span>
                        </div>
                        <span className="count-badge">{cands.length}</span>
                      </div>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setNewCand(p => ({ ...p, position: pos })); setShowCandModal(true); }} style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700 }}>
                        <Plus size={13} /> Add to this position
                      </button>
                    </div>
                    <div className="position-lane-body">
                      {cands.map(c => {
                        const el = elections.find(e => e.id === c.electionId);
                        return (
                          <div key={c.id} className="cand-roster-card">
                            {c.picture ? (
                              <img src={api.getUrl(c.picture)} alt={c.name} className="cand-avatar" />
                            ) : (
                              <div className="cand-avatar-fallback" style={{ background: c.color || 'var(--green-600)' }}>
                                {c.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            )}
                            <div className="cand-info">
                              <div className="cand-name">{c.name}</div>
                              <div className="cand-meta">{c.department || 'No department'}</div>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                <span className="cand-position-tag">{c.position}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--green-50)', color: 'var(--green-800)', border: '1px solid var(--green-200)', padding: '2px 6px', borderRadius: 6 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700 }}>Ballot No.</span>
                                  <input
                                    type="number"
                                    defaultValue={c.ballotNumber || ''}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val !== (c.ballotNumber || '')) {
                                        updateCandidate(c.id, { ...c, ballotNumber: val });
                                        addToast({ type: 'success', message: `Ballot number updated for ${c.name}` });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') e.target.blur();
                                    }}
                                    placeholder="-"
                                    style={{ width: 36, height: 18, fontSize: 11, fontWeight: 700, textAlign: 'center', border: 'none', background: 'var(--white)', borderRadius: 3, outline: 'none' }}
                                  />
                                </div>
                                {el && <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 500 }}>{el.title}</span>}
                              </div>
                            </div>
                            <div className="cand-actions" style={{ display: 'flex', gap: 6 }}>
                              <button
                                title="Edit Candidate"
                                onClick={() => {
                                  setEditingCand({
                                    id: c.id,
                                    electionId: c.electionId,
                                    name: c.name,
                                    position: c.position,
                                    manifesto: c.manifesto || '',
                                    color: c.color || '#2e7d32',
                                    picture: c.picture || '',
                                    department: c.department || '',
                                    ballotNumber: c.ballotNumber || ''
                                  });
                                  setShowCandModal(true);
                                }}
                                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--white)', color: 'var(--navy-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green-500)'; e.currentTarget.style.color = 'var(--green-600)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--navy-600)'; }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                title="Delete Candidate"
                                onClick={() => {
                                  if (window.confirm(`Remove "${c.name}" from the ballot?`)) {
                                    deleteCandidate(c.id);
                                    addToast({ type: 'success', title: 'Candidate Removed', message: `${c.name} has been removed from the ballot.` });
                                  }
                                }}
                                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--red-100)', background: 'var(--red-50)', color: 'var(--red-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-500)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--red-50)'; e.currentTarget.style.color = 'var(--red-500)'; }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--white)', borderRadius: 16, border: '1.5px dashed var(--border)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--green-50)', border: '1px solid var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Users size={28} style={{ color: 'var(--green-300)' }} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-700)', marginBottom: 6 }}>
                  {candSearch || candElFilter !== 'all' || candPosFilter !== 'all' ? 'No candidates match your filters' : 'No Candidates Registered Yet'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--navy-400)', maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.6 }}>
                  {candSearch || candElFilter !== 'all' || candPosFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Start by creating an election, then register candidates with their photos and positions.'}
                </p>
                {!candSearch && candElFilter === 'all' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowCandModal(true)} style={{ borderRadius: 8 }}>
                    <Plus size={14} /> Register First Candidate
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── VOTERS ── */}
      {tab === 'voters' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header + Actions Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)', marginBottom: 4 }}>Voter Registry</h3>
              <p style={{ fontSize: 13, color: 'var(--navy-400)', lineHeight: 1.5 }}>Import voter data from CSV or Excel files. Columns are auto-detected.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {voterUsers.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleClearRegistry(filterYear)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red-600)', border: '1.5px solid var(--red-100)', background: 'var(--red-50)' }}
                >
                  <Trash2 size={14} />
                  {filterYear && filterYear !== 'all' ? `Clear ${filterYear}` : 'Clear Register'}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} />Download Template
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Upload size={14} />Upload File
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCSV} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {[
              { label: 'Total Eligible Voters', value: voterUsers.length, icon: Users },
              { label: 'Departments', value: departments.length, icon: ClipboardList },
              { label: 'Import Status', value: voterUsers.length > 0 ? '✓ Ready' : 'Pending', icon: CheckCircle },
              ...(importStats ? [{ label: 'Last Import', value: `${importStats.count} records`, icon: FileSpreadsheet }] : []),
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--navy-50)', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <s.icon size={14} style={{ color: 'var(--green-600)' }} />
                  <span style={{ fontSize: 11, color: 'var(--navy-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-800)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--green-500)' : 'var(--navy-200)'}`,
              background: dragOver ? 'var(--green-50)' : 'linear-gradient(135deg, var(--navy-50) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: 16,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              transform: dragOver ? 'scale(1.01)' : 'scale(1)',
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 12, background: dragOver ? 'var(--green-100)' : 'var(--navy-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', transition: 'all 0.2s ease' }}>
              <FileSpreadsheet size={24} style={{ color: dragOver ? 'var(--green-600)' : 'var(--navy-400)' }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: dragOver ? 'var(--green-700)' : 'var(--navy-700)', marginBottom: 4 }}>
              {dragOver ? 'Drop file here to preview' : 'Drag & drop a file here, or click to browse'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--navy-400)' }}>
              Supports <strong>.csv</strong>, <strong>.xlsx</strong>, and <strong>.xls</strong> files
            </div>
            {csvFile && !showImportPreview && (
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--green-700)', background: 'var(--green-50)', padding: '5px 12px', borderRadius: 99, border: '1px solid var(--green-100)' }}>
                <Check size={13} />{csvFile.name}
              </div>
            )}
          </div>

          {/* Last import summary */}
          {importStats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 10, fontSize: 12 }}>
              <CheckCircle size={15} style={{ color: 'var(--green-600)', flexShrink: 0 }} />
              <span style={{ color: 'var(--green-800)' }}>
                <strong>{importStats.count} voters</strong> imported from <strong>{importStats.fileName}</strong> on {new Date(importStats.timestamp).toLocaleString()}
              </span>
            </div>
          )}

          {/* Voter Filter Bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--navy-100)', paddingTop: 20 }}>
            <input type="text" placeholder="Search name, ID, email..." value={searchVoter} onChange={e => setSearchVoter(e.target.value)} className="form-input" style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 300 }} />

            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="form-input" style={{ width: 'auto', minWidth: 160, color: 'var(--navy-800)', border: '1.5px solid var(--navy-100)' }}>
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
              ))}
            </select>

            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="form-input" style={{ width: 'auto', minWidth: 120, color: 'var(--navy-800)', border: '1.5px solid var(--navy-100)' }}>
              <option value="all">All Years</option>
              {[...new Set(voterUsers.map(u => String(u.year || 'N/A')))].sort().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-input" style={{ width: 'auto', minWidth: 120, color: 'var(--navy-800)', border: '1.5px solid var(--navy-100)' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            {(filterDept !== 'all' || filterYear !== 'all' || filterStatus !== 'all' || searchVoter) && (
              <button
                onClick={() => { setFilterDept('all'); setFilterYear('all'); setFilterStatus('all'); setSearchVoter(''); }}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--navy-500)', border: '1px solid var(--navy-200)', background: 'var(--navy-50)', padding: '8px 12px' }}
              >
                Reset
              </button>
            )}

            {voterUsers.length > 0 && (
              <span style={{ fontSize: 13, color: 'var(--navy-500)', marginLeft: 'auto' }}>
                Showing <strong>{filteredVoters.length}</strong> of <strong>{voterUsers.length}</strong> voters
              </span>
            )}
          </div>

          {/* Voter List Table */}
          <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--navy-100)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {renderSortHeader('name', 'Name')}
                  {renderSortHeader('studentId', 'Student/Reference ID')}
                  <th>Email</th>
                  <th>Phone Number</th>
                  {renderSortHeader('year', 'Year')}
                  {renderSortHeader('department', 'Department')}
                  {renderSortHeader('status', 'Status')}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVoters.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--navy-400)' }}>
                      No registered voters found. Upload a registry file or add a user manually.
                    </td>
                  </tr>
                ) : (
                  filteredVoters.map(u => {
                    const dept = departments.find(d => d.id === u.departmentId);
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 700 }}>{u.name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.studentId}</td>
                        <td>{u.email}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.phoneNumber || 'N/A'}</td>
                        <td style={{ fontSize: 12 }}>{u.year || 'N/A'}</td>
                        <td style={{ fontSize: 12 }}>{dept ? `${dept.name} (${dept.code})` : 'Department of Computing and Data Analytics'}</td>
                        <td>
                          <span
                            className={`badge-${u.status === 'active' ? 'active' : 'closed'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => updateUser({ id: u.id, status: u.status === 'active' ? 'suspended' : 'active' })}
                          >
                            ● {u.status || 'Active'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={async () => {
                              try {
                                setEditingUser({ ...u, loading: true });
                                const fullUser = await api.getUser(u.id);
                                setEditingUser({ ...fullUser, loading: false });
                              } catch (err) {
                                console.error(err);
                                addToast({ type: 'error', title: 'Load Failed', message: 'Failed to access voter profile (audit logged).' });
                                setEditingUser(null);
                              }
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--green-700)', marginRight: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete voter ${u.name}?`)) deleteUser(u.id); }}
                            style={{ background: 'none', border: 'none', color: 'var(--red-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── USER MANAGEMENT ── */}
      {tab === 'users' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>User Management</h3>
              <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Manage system users, roles, and administrative access permissions.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddUserModal(true)}><Plus size={14} />Add User</button>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <input type="text" placeholder="Search by name, email or Student ID..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className="form-input" style={{ maxWidth: 360 }} />
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Student ID</th><th>Email</th><th>Phone Number</th><th>Year</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.filter(u => !searchUser || u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.studentId.toLowerCase().includes(searchUser.toLowerCase())).map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>{u.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.studentId}</td>
                    <td>{u.email}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.phoneNumber || 'N/A'}</td>
                    <td style={{ fontSize: 12 }}>{u.year || 'N/A'}</td>
                    <td>
                      <select value={u.role} onChange={e => updateUser({ id: u.id, role: e.target.value })} className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 'auto', display: 'inline-block' }}>
                        <option value="voter">Voter</option>
                        <option value="admin">Admin</option>
                        <option value="auditor">Auditor</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge-${u.status === 'active' ? 'active' : 'closed'}`} style={{ cursor: 'pointer' }} onClick={() => updateUser({ id: u.id, status: u.status === 'active' ? 'suspended' : 'active' })}>
                        ● {u.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={async () => {
                          try {
                            setEditingUser({ ...u, loading: true });
                            const fullUser = await api.getUser(u.id);
                            setEditingUser({ ...fullUser, loading: false });
                          } catch (err) {
                            console.error(err);
                            addToast({ type: 'error', title: 'Load Failed', message: 'Failed to access user details (audit logged).' });
                            setEditingUser(null);
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--green-700)', marginRight: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button onClick={() => { if (confirm('Delete user?')) deleteUser(u.id); }} style={{ background: 'none', border: 'none', color: 'var(--red-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NOTICE BOARD ── */}
      {tab === 'notices' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>Notice Board Announcements</h3>
            {announcements.map(ann => (
              <div key={ann.id} className="card card-padded" style={{ borderLeft: `4px solid ${ann.category === 'warning' ? 'var(--gold-500)' : ann.category === 'error' ? 'var(--red-500)' : 'var(--green-500)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)' }}>{ann.title}</h4>
                  <span style={{ fontSize: 10, color: 'var(--navy-400)', fontFamily: 'var(--font-mono)' }}>{new Date(ann.timestamp).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--navy-600)', marginTop: 8, lineHeight: 1.6 }}>{ann.content}</p>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--navy-50)', padding: '2px 8px', borderRadius: 99, color: 'var(--navy-500)' }}>Category: {ann.category}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--navy-50)', padding: '2px 8px', borderRadius: 99, color: 'var(--navy-500)' }}>Scope: {ann.target}</span>
                </div>
              </div>
            ))}
            {!announcements.length && <p style={{ color: 'var(--navy-400)' }}>No system notices posted.</p>}
          </div>

          <div className="card card-padded">
            <h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 12 }}>Broadcast Notice</h4>
            <form onSubmit={handleAddNotice} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {inp('Notice Title *', newNotice.title, v => setNewNotice(p => ({ ...p, title: v })), { placeholder: 'e.g. Turnout update' })}
              {inp('Notice Scope', newNotice.target, v => setNewNotice(p => ({ ...p, target: v })), { select: <><option value="all">System-wide</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</> })}
              {inp('Notice Category', newNotice.category, v => setNewNotice(p => ({ ...p, category: v })), { select: <><option value="info">Info (Green)</option><option value="warning">Warning (Gold)</option><option value="error">Critical Alert (Red)</option></> })}
              {inp('Content *', newNotice.content, v => setNewNotice(p => ({ ...p, content: v })), { textarea: true, placeholder: 'Announcement body text...' })}
              <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', height: 38, marginTop: 6 }}>Publish Notice</button>
            </form>
          </div>
        </div>
      )}

      {/* ── ELECTION CALENDAR ── */}
      {tab === 'calendar' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>Election Schedule Timeline</h3>
            <p style={{ fontSize: 12, color: 'var(--navy-400)' }}>Visual sequence and chronologically sorted election roadmap.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', paddingLeft: 20, borderLeft: '2px solid var(--border)' }}>
            {elections.map(el => {
              const start = new Date(el.startTime);
              const end = new Date(el.endTime);
              const isPast = end < getSyncedDate();
              const isFuture = start > getSyncedDate();
              const isCurrent = !isPast && !isFuture;

              return (
                <div key={el.id} style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -27, top: 4, width: 12, height: 12, borderRadius: '50%',
                    background: isCurrent ? 'var(--green-500)' : isFuture ? 'var(--gold-500)' : 'var(--gray-400)',
                    border: '2px solid #fff'
                  }} />
                  <div className="card card-padded" style={{ opacity: isPast ? 0.75 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isCurrent ? 'var(--green-50)' : isFuture ? 'var(--gold-50)' : 'var(--gray-100)', color: isCurrent ? 'var(--green-700)' : isFuture ? 'var(--gold-700)' : 'var(--gray-600)', marginRight: 6 }}>
                          {isCurrent ? 'ACTIVE POLL' : isFuture ? 'UPCOMING' : 'COMPLETED'}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--navy-400)' }}>{el.id}</span>
                        <h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginTop: 6 }}>{el.title}</h4>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--navy-500)', fontWeight: 600 }}>{el.type}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, color: 'var(--navy-600)' }}>
                      <div><strong>Starts:</strong> {start.toLocaleString()}</div>
                      <div><strong>Ends:</strong> {end.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SYSTEM CONFIGURATION ── */}
      {tab === 'config' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div className="card card-padded">
            <h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 16 }}>Voting Rules & Toggles</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'allowRevision', label: 'Allow Vote Revision', desc: 'Allows voters to modify and overwrite their cast votes before polls close.' },
                { key: 'doubleSign', label: 'Anonymous Receipt Hashing', desc: 'Auto-hashes voter IDs to guarantee complete vote trace anonymity.' },
                { key: 'mfaRequired', label: 'Require Student Email Verification', desc: 'Sends verification codes to authorized UMaT emails before ballot access.' }
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-800)' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 2, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                  <input type="checkbox" checked={config[item.key]} onChange={e => setConfig(p => ({ ...p, [item.key]: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--green-500)' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 6 }}>Branding & Session Variables</h4>
              <p style={{ fontSize: 11, color: 'var(--navy-400)' }}>Customize identity settings and administrative session limits.</p>
            </div>
            {inp('Institutional Portal Title', config.appName, v => setConfig(p => ({ ...p, appName: v })))}
            {inp('Session Expiry Timeout (Minutes)', config.sessionTimeout, v => setConfig(p => ({ ...p, sessionTimeout: Number(v) })), { type: 'number' })}
            <button className="btn btn-primary btn-sm" onClick={() => addToast({ type: 'success', title: 'Settings Saved', message: 'System configuration has been successfully updated.' })} style={{ height: 38, marginTop: 4 }}>Save Configuration</button>
          </div>

          <div className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginBottom: 6 }}>Polling Agent Watcher Portal</h4>
              <p style={{ fontSize: 11, color: 'var(--navy-400)' }}>Deploy a secure, read-only live results display for candidates' external polling representatives.</p>
            </div>
            <div style={{ background: 'var(--green-50)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--green-100)' }}>
              <div style={{ fontSize: 11, color: 'var(--green-800)', fontWeight: 700, marginBottom: 2 }}>🔓 Public Read-Only Access Enabled</div>
              <div style={{ fontSize: 10.5, color: 'var(--green-700)' }}>Agents can scan live standings directly without needing accounts.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => {
                  const agentUrl = window.location.origin + '/?view=agent';
                  navigator.clipboard.writeText(agentUrl);
                  addToast({ type: 'success', title: 'Link Copied', message: 'Polling agent live link copied to clipboard.' });
                }}
              >
                📋 Copy Portal Link
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ width: '100%', background: 'var(--green-600)', border: '1px solid var(--green-600)', color: '#fff' }}
                onClick={() => {
                  window.open('/?view=agent', '_blank');
                }}
              >
                👁️ Launch Telemetry Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {tab === 'results' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>Results Management</h3>
          {elections.map(el => {
            const cands = candidates.filter(c => c.electionId === el.id);
            const winner = el.status === 'closed' && cands.length ? cands.reduce((mx, c) => c.voteCount > mx.voteCount ? c : mx, cands[0]) : null;
            return (
              <div key={el.id} className="card card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div><StatusBadge status={el.status} /><h4 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy-900)', marginTop: 6 }}>{el.title}</h4></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['PDF', 'CSV'].map(fmt => (
                      <button key={fmt} className="btn btn-secondary btn-sm" onClick={() => addToast({ type: 'success', message: `Exporting as ${fmt}…` })}><FileDown size={13} />{fmt}</button>
                    ))}
                  </div>
                </div>
                {cands.map(c => {
                  const pct = el.totalVotesCast > 0 ? Math.round((c.voteCount / el.totalVotesCast) * 100) : 0;
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--navy-700)' }}>{c.name}</span>
                        <span style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{c.voteCount} votes ({pct}%)</span>
                      </div>
                      <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${pct}%`, background: c.color }} /></div>
                    </div>
                  );
                })}
                {winner && (
                  <div style={{ background: 'var(--emerald-50)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🏆</span>
                    <div><div style={{ fontSize: 11, color: 'var(--emerald-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Winner</div><div style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{winner.name} — {winner.voteCount} votes</div></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── AUDIT ── */}
      {tab === 'audit' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy-900)' }}>System Audit Log</h3>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--amber-600)', background: 'var(--amber-50)', border: '1px solid var(--amber-100)', padding: '4px 10px', borderRadius: 99 }}>
              <ShieldAlert size={13} />Cryptographic Trail
            </span>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Action</th><th>Performed By</th><th>Role</th><th>Timestamp</th><th>Metadata</th></tr></thead>
              <tbody>
                {auditLogs.map(log => {
                  const rc = ROLE_COLORS[log.role] || ROLE_COLORS.Voter;
                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{log.action}</td>
                      <td>{log.performedBy}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: rc.bg, color: rc.color }}>{log.role}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--navy-400)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--navy-400)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JSON.stringify(log.metadata)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Election Modal (WIZARD FLOW) */}
      <ConfirmModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleWizardNext}
        title="Setup New Election Campaign"
        confirmText={wizardStep === 4 ? "Finalize Campaign" : "Next Step"}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
          {/* Stepper progress indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--navy-50)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
            {[
              { step: 1, label: 'Details', icon: <ClipboardList size={14} /> },
              { step: 2, label: 'Ballot Roles', icon: <Layers size={14} /> },
              { step: 3, label: 'Voters', icon: <UserCheck size={14} /> },
              { step: 4, label: 'Schedule', icon: <Calendar size={14} /> },
            ].map((s, idx) => {
              const isActive = wizardStep === s.step;
              const isPast = wizardStep > s.step;
              return (
                <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: s.step === 4 ? 'none' : '1' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: isPast ? 'var(--green-600)' : isActive ? 'var(--green-500)' : 'var(--gray-300)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, transition: 'all 0.2s'
                  }}>
                    {isPast ? '✓' : s.icon}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: isActive || isPast ? 800 : 500,
                    color: isActive ? 'var(--green-600)' : isPast ? 'var(--navy-700)' : 'var(--navy-300)',
                    whiteSpace: 'nowrap'
                  }}>
                    {s.label}
                  </span>
                  {s.step < 4 && (
                    <div style={{ flex: 1, height: 2, background: isPast ? 'var(--green-500)' : 'var(--gray-200)', margin: '0 8px', minWidth: 20 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* STEP 1: DETAILS */}
          {wizardStep === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inp('Election Title *', newElec.title, v => setNewElec(p => ({ ...p, title: v })), { placeholder: 'e.g. CSR Executive Election 2026', required: true })}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {inp('Assigned Department', newElec.departmentId, v => setNewElec(p => ({ ...p, departmentId: v })), { select: <><option value="">Master Registry (All Departments)</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</> })}
                  {inp('Poll / Campaign Type', newElec.type, v => setNewElec(p => ({ ...p, type: v })), { select: ['Student Representative', 'Departmental Committee', 'Faculty Officer', 'Referendum'].map(t => <option key={t} value={t}>{t}</option>) })}
                </div>

                {inp('Purpose / Description', newElec.description, v => setNewElec(p => ({ ...p, description: v })), { textarea: true, placeholder: 'Detail the agenda, rules, and scope of this election campaign…' })}
              </div>
            </div>
          )}

          {/* STEP 2: BALLOT STRUCTURE (POSITIONS BUILDER) */}
          {wizardStep === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h4 style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--navy-900)', marginBottom: 4 }}>Define Ballot Positions & Structure</h4>
                <p style={{ fontSize: 11.5, color: 'var(--navy-400)', margin: 0 }}>Register and sequence ballot positions one by one to configure your voting structure.</p>
              </div>

              {/* High-fidelity Input panel */}
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 10.5, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Ballot Role / Position Title *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--navy-300)', display: 'flex', alignItems: 'center' }}>
                      <Layers size={13} />
                    </div>
                    <input
                      type="text"
                      id="wiz-new-cat"
                      placeholder="e.g. SRC President, Organising Secretary..."
                      className="form-input"
                      style={{ height: 38, borderRadius: 8, paddingLeft: 30, fontSize: 12 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.target.value.trim();
                          if (val && !newElec.categories.includes(val)) {
                            setNewElec(p => ({ ...p, categories: [...p.categories, val] }));
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: 38, borderRadius: 8, padding: '0 16px', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => {
                      const inpEl = document.getElementById('wiz-new-cat');
                      const val = inpEl?.value?.trim();
                      if (val && !newElec.categories.includes(val)) {
                        setNewElec(p => ({ ...p, categories: [...p.categories, val] }));
                        inpEl.value = '';
                      }
                    }}
                  >
                    <Plus size={12} /> Add Role
                  </button>
                </div>
              </div>

              {/* Positions List Display (Beautiful visual rows) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
                {(newElec.categories || []).map((c, i) => {
                  const idxStr = String(i + 1).padStart(2, '0');
                  return (
                    <div
                      key={c}
                      style={{
                        background: 'var(--white)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          background: 'var(--green-50)',
                          color: 'var(--green-800)',
                          border: '1px solid var(--green-200)',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {idxStr}
                        </span>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--navy-900)' }}>{c}</div>
                          <span style={{ fontSize: 10, color: 'var(--navy-300)' }}>Aspirants can be added to this ballot role after creation.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewElec(p => ({ ...p, categories: p.categories.filter(cat => cat !== c) }))}
                        style={{
                          border: 'none',
                          background: 'var(--red-50)',
                          color: 'var(--red-600)',
                          fontSize: 12,
                          cursor: 'pointer',
                          borderRadius: 6,
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700
                        }}
                        title="Remove ballot position"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {!(newElec.categories || []).length && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px 12px',
                    background: 'var(--gray-50)',
                    border: '1.5px dashed var(--border)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{ fontSize: 22 }}>📋</span>
                    <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--navy-800)' }}>No Ballot Roles Defined</div>
                    <p style={{ fontSize: 10.5, color: 'var(--navy-400)', margin: '0 0 4px 0' }}>Define at least one position (e.g. CSR President) above to progress.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: VOTERS */}
          {wizardStep === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                {inp('Estimated Eligible Voters Count *', newElec.eligibleVoterCount, v => setNewElec(p => ({ ...p, eligibleVoterCount: Number(v) })), { type: 'number', required: true })}
                <p style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 6, marginBottom: 0 }}>Input the absolute count of authorized students qualified to participate in this poll.</p>
              </div>

              <div style={{ background: 'var(--navy-50)', border: '1px solid var(--border)', padding: '16px 20px', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, marginTop: -2 }}>🛡️</span>
                <div style={{ fontSize: 12, color: 'var(--navy-600)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--navy-900)', display: 'block', marginBottom: 4 }}>Institutional Security Verification</strong>
                  Voter registry eligibility rules will be strictly enforced during validation. Student voters must exist on the master UMaT student registry under program requirements to gain ballot access. Detailed CSV files can be imported after draft finalization.
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SCHEDULE */}
          {wizardStep === 4 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: 'var(--white)', border: '1px solid var(--border)', padding: 20, borderRadius: 12 }}>
                {inp('Start Date & Time *', newElec.startTime, v => setNewElec(p => ({ ...p, startTime: v })), { type: 'datetime-local', required: true })}
                {inp('End Date & Time *', newElec.endTime, v => setNewElec(p => ({ ...p, endTime: v })), { type: 'datetime-local', required: true })}
              </div>

              <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)', padding: '16px 20px', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, color: 'var(--green-600)', marginTop: -2 }}>✓</span>
                <div style={{ fontSize: 12.5, color: 'var(--green-800)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--navy-900)', display: 'block', marginBottom: 4 }}>Ready for Campaign Launch!</strong>
                  The wizard details are parsed. You are launching a new draft campaign with <strong>{(newElec.categories || []).length} ballot positions</strong>. Once created, you can add aspirants to each ballot position directly from the Elections management dashboard or Candidates workspace.
                </div>
              </div>
            </div>
          )}

          {/* Back Navigation Control */}
          {wizardStep > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWizardStep(wizardStep - 1)} style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Back to Step {wizardStep - 1}
              </button>
            </div>
          )}
        </div>
      </ConfirmModal>

      {/* Redesigned Add Candidate Drawer */}
      {showCandModal && (() => {
        const activeCand = editingCand || newCand;
        const setActiveProps = (updater) => {
          if (editingCand) {
            setEditingCand(updater);
          } else {
            setNewCand(updater);
          }
        };
        const handleCancel = () => {
          setShowCandModal(false);
          setEditingCand(null);
        };
        const handleSave = editingCand ? handleUpdateCand : handleAddCand;
        return (
          <div className="cand-drawer-overlay animate-fade-in" onClick={handleCancel}>
            <div className="cand-drawer animate-slide-in-right" onClick={e => e.stopPropagation()}>
              <div className="cand-drawer-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Users size={20} style={{ color: 'var(--green-600)' }} />
                    {editingCand ? 'Edit Candidate Details' : 'Register Candidate'}
                  </h3>
                  <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-400)', padding: 4, display: 'flex', alignItems: 'center' }}>
                    <X size={20} />
                  </button>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--navy-500)', marginTop: 4, marginBottom: 0 }}>
                  Enter the official credentials & credentials of the candidate for ballot placement.
                </p>
              </div>

              <div className="cand-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Photo & Color Selection Header Block */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'var(--navy-50)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)' }}>
                  {/* Drag-drop or click Photo block */}
                  <label className={`photo-upload-zone ${activeCand.picture ? 'has-photo' : ''}`}>
                    {activeCand.picture ? (
                      <img src={api.getUrl(activeCand.picture)} alt="Preview" />
                    ) : (
                      <>
                        <Upload size={20} style={{ color: 'var(--navy-400)' }} />
                        <div className="upload-hint">Upload Photo</div>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setActiveProps(p => ({ ...p, picture: reader.result }));
                      };
                      reader.readAsDataURL(file);
                    }} style={{ display: 'none' }} />
                  </label>

                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ballot Branding color</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                      <input type="color" value={activeCand.color} onChange={e => setActiveProps(p => ({ ...p, color: e.target.value }))} style={{ width: 44, height: 40, border: '1.5px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--navy-700)' }}>{activeCand.color}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--navy-400)', marginTop: 6, marginBottom: 0 }}>This theme color is used in results pages & charts.</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {inp('Election Registry *', activeCand.electionId, v => setActiveProps(p => ({ ...p, electionId: v })), { select: <><option value="">-- Choose target election --</option>{elections.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</> })}

                  {inp('Full Candidate Name *', activeCand.name, v => setActiveProps(p => ({ ...p, name: v })), { placeholder: 'e.g. Samuel Osei Tutu', required: true })}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {elections.find(e => e.id === activeCand.electionId)?.categories?.length ? (
                      inp('Position *', activeCand.position, v => setActiveProps(p => ({ ...p, position: v })), {
                        select: (
                          <>
                            <option value="">-- Choose position --</option>
                            {elections.find(e => e.id === activeCand.electionId).categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </>
                        )
                      })
                    ) : (
                      inp('Position *', activeCand.position, v => setActiveProps(p => ({ ...p, position: v })), { placeholder: 'e.g. SRC President', required: true })
                    )}

                    {inp('Department Affiliation', activeCand.department || '', v => setActiveProps(p => ({ ...p, department: v })), {
                      select: (
                        <>
                          <option value="">-- Select Department --</option>
                          {departments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                          <option value="Department of Computing and Data Analytics">Dept. of Computing & Data Analytics</option>
                        </>
                      )
                    })}
                  </div>

                  {inp('Ballot Order Number (e.g. 1, 2, 3)', activeCand.ballotNumber || '', v => setActiveProps(p => ({ ...p, ballotNumber: v })), { type: 'number', placeholder: 'Set order number on the ballot paper' })}
                </div>
              </div>

              <div className="cand-drawer-footer">
                <button className="btn btn-secondary" style={{ flex: 1, borderRadius: 8 }} onClick={handleCancel}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, borderRadius: 8, background: 'var(--green-600)', borderColor: 'var(--green-700)' }} onClick={handleSave}>
                  {editingCand ? 'Save Changes' : 'Register Ballot Entry'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add User Modal */}
      <ConfirmModal isOpen={showAddUserModal} onClose={() => setShowAddUserModal(false)} onConfirm={handleAddUser} title="Register New User" confirmText="Register User">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {inp('Full Name *', newUser.name, v => setNewUser(p => ({ ...p, name: v })), { placeholder: 'e.g. Dr. John Doe' })}
          {inp('Student/Staff ID *', newUser.studentId, v => setNewUser(p => ({ ...p, studentId: v })), { placeholder: 'e.g. UMaT/CSE/22/045' })}
          {inp('Email Address *', newUser.email, v => setNewUser(p => ({ ...p, email: v })), { placeholder: 'e.g. student@umat.edu.gh' })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('Phone Number', newUser.phoneNumber, v => setNewUser(p => ({ ...p, phoneNumber: v })), { placeholder: 'e.g. 0244000000' })}
            {inp('Academic Year / Level', newUser.year, v => setNewUser(p => ({ ...p, year: v })), { placeholder: 'e.g. YEAR 1' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('System Role', newUser.role, v => setNewUser(p => ({ ...p, role: v })), { select: <><option value="voter">Student Voter</option><option value="admin">Administrator</option><option value="auditor">Independent Auditor</option></> })}
            {inp('Department Associated', newUser.departmentId, v => setNewUser(p => ({ ...p, departmentId: v })), { select: <><option value="">None (Department of Computing and Data Analytics)</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</> })}
          </div>
          {(newUser.role === 'admin' || newUser.role === 'auditor') && (
            inp('Login Password *', newUser.password || '', v => setNewUser(p => ({ ...p, password: v })), { type: 'password', placeholder: 'Set default password for Administrative Access' })
          )}
        </div>
      </ConfirmModal>

      {/* Edit User Modal */}
      <ConfirmModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onConfirm={handleUpdateUser}
        title="Edit User Details"
        confirmText={editingUser?.loading ? "Loading..." : "Save Changes"}
        disabled={editingUser?.loading}
      >
        {editingUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {editingUser.loading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--navy-500)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span className="animate-spin" style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid rgba(46,125,50,0.2)', borderTopColor: 'var(--green-600)', borderRadius: '50%' }}></span>
                Retrieving unmasked user records (audit logged)...
              </div>
            ) : (
              <>
                {inp('Full Name *', editingUser.name, v => setEditingUser(p => ({ ...p, name: v })))}
                {inp('Student/Staff ID *', editingUser.studentId, v => setEditingUser(p => ({ ...p, studentId: v })), { required: true })}
                {inp('Email Address *', editingUser.email, v => setEditingUser(p => ({ ...p, email: v })))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {inp('Phone Number', editingUser.phoneNumber || '', v => setEditingUser(p => ({ ...p, phoneNumber: v })), { placeholder: 'e.g. 0244000000' })}
                  {inp('Academic Year / Level', editingUser.year || '', v => setEditingUser(p => ({ ...p, year: v })), { placeholder: 'e.g. YEAR 1' })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {inp('System Role', editingUser.role, v => setEditingUser(p => ({ ...p, role: v })), { select: <><option value="voter">Student Voter</option><option value="admin">Administrator</option><option value="auditor">Independent Auditor</option></> })}
                  {inp('Department Associated', editingUser.departmentId || '', v => setEditingUser(p => ({ ...p, departmentId: v })), { select: <><option value="">None (Department of Computing and Data Analytics)</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</> })}
                </div>
                {editingUser.role === 'voter' && (
                  <div style={{ padding: 12, background: 'var(--navy-50)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div style={{ fontSize: 13, color: 'var(--navy-700)' }}>
                      🔑 SMS OTP Codes Sent: <strong style={{ color: (editingUser.otpCount || 0) >= 2 ? 'var(--red-600)' : 'var(--navy-900)' }}>{editingUser.otpCount || 0} / 2</strong>
                    </div>
                    {(editingUser.otpCount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(p => ({ ...p, otpCount: 0 }));
                          addToast({ type: 'info', message: 'SMS counter set to 0. Press "Save Changes" to apply.' });
                        }}
                        style={{
                          background: 'var(--red-50)',
                          border: '1.5px solid var(--red-100)',
                          color: 'var(--red-600)',
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.target.style.background = 'var(--red-100)'; }}
                        onMouseLeave={e => { e.target.style.background = 'var(--red-50)'; }}
                      >
                        Reset SMS Counter
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </ConfirmModal>

      {/* Edit Election Modal */}
      <ConfirmModal isOpen={!!editingElection} onClose={() => setEditingElection(null)} onConfirm={handleUpdateElection} title="Edit Election Details" confirmText="Save Changes">
        {editingElection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {inp('Election Title *', editingElection.title, v => setEditingElection(p => ({ ...p, title: v })), { required: true })}
            {inp('Election Description', editingElection.description, v => setEditingElection(p => ({ ...p, description: v })), { textarea: true })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {inp('Election Type', editingElection.type, v => setEditingElection(p => ({ ...p, type: v })), {
                select: (
                  <>
                    <option value="Student Representative">Student Representative</option>
                    <option value="Departmental Committee">Departmental Committee</option>
                    <option value="Department-wide Poll">Department-wide Poll</option>
                  </>
                )
              })}
              {inp('Department Associated', editingElection.departmentId || '', v => setEditingElection(p => ({ ...p, departmentId: v || null })), {
                select: (
                  <>
                    <option value="">None (Department of Computing and Data Analytics)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {inp('Start Date *', formatDateTimeLocal(editingElection.startTime), v => setEditingElection(p => ({ ...p, startTime: v })), { type: 'datetime-local', required: true })}
              {inp('End Date *', formatDateTimeLocal(editingElection.endTime), v => setEditingElection(p => ({ ...p, endTime: v })), { type: 'datetime-local', required: true })}
            </div>
            {inp('Estimated Eligible Voters Count', editingElection.eligibleVoterCount || 0, v => setEditingElection(p => ({ ...p, eligibleVoterCount: Number(v) })), { type: 'number' })}
          </div>
        )}
      </ConfirmModal>

      {/* ── IMPORT PREVIEW MODAL ── */}
      {showImportPreview && importPreview && (
        <div className="modal-overlay" onClick={() => { setShowImportPreview(false); setImportPreview(null); }} role="dialog" aria-modal="true">
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 820, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={18} style={{ color: 'var(--green-600)' }} />Import Preview
                </h3>
                <p style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 4 }}>
                  Review parsed data from <strong>{importPreview.fileName}</strong> before importing.
                </p>
              </div>
              <button onClick={() => { setShowImportPreview(false); setImportPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--navy-400)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Column Mapping Badges */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Auto-Detected Columns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(importPreview.mappedColumns).map(([key, col]) => (
                  <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: 'var(--green-50)', color: 'var(--green-700)', border: '1px solid var(--green-100)' }}>
                    <Check size={11} />{col.label} → <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>"{col.header}"</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Stats summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--navy-50)', padding: '10px 14px', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--navy-400)', fontWeight: 700, textTransform: 'uppercase' }}>Total Rows</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-800)' }}>{importPreview.totalDataRows}</div>
              </div>
              <div style={{ background: 'var(--green-50)', padding: '10px 14px', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--green-600)', fontWeight: 700, textTransform: 'uppercase' }}>Valid Records</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green-700)' }}>{importPreview.validCount}</div>
              </div>
              <div style={{ background: importPreview.warnings.length ? 'var(--gold-50)' : 'var(--navy-50)', padding: '10px 14px', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: importPreview.warnings.length ? 'var(--gold-600)' : 'var(--navy-400)', fontWeight: 700, textTransform: 'uppercase' }}>Warnings</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: importPreview.warnings.length ? 'var(--gold-700)' : 'var(--navy-800)' }}>{importPreview.warnings.length}</div>
              </div>
            </div>

            {/* Warnings Panel */}
            {importPreview.warnings.length > 0 && (
              <div style={{ background: 'var(--gold-50)', border: '1px solid var(--gold-100)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, maxHeight: 80, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--gold-700)', marginBottom: 4 }}>
                  <AlertTriangle size={13} />Validation Warnings
                </div>
                {importPreview.warnings.slice(0, 10).map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--gold-600)', paddingLeft: 20, lineHeight: 1.6 }}>• {w}</div>
                ))}
                {importPreview.warnings.length > 10 && (
                  <div style={{ fontSize: 11, color: 'var(--gold-500)', paddingLeft: 20, fontStyle: 'italic' }}>
                    ...and {importPreview.warnings.length - 10} more warnings
                  </div>
                )}
              </div>
            )}

            {/* Scrollable Data Preview Table */}
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--navy-100)', borderRadius: 10, marginBottom: 16, minHeight: 0 }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Name</th>
                    <th>Student ID</th>
                    <th>Email</th>
                    {importPreview.mappedColumns.phone && <th>Phone</th>}
                    {importPreview.mappedColumns.year && <th>Year</th>}
                    {importPreview.mappedColumns.department && <th>Department</th>}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--navy-400)', fontFamily: 'var(--font-mono)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{r.studentId}</td>
                      <td>{r.email}</td>
                      {importPreview.mappedColumns.phone && <td style={{ fontFamily: 'var(--font-mono)' }}>{r.phone || '—'}</td>}
                      {importPreview.mappedColumns.year && <td>{r.year || '—'}</td>}
                      {importPreview.mappedColumns.department && <td>{r.department || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.rows.length > 100 && (
                <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: 'var(--navy-400)', background: 'var(--navy-50)' }}>
                  Showing first 100 of {importPreview.rows.length} records
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowImportPreview(false); setImportPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handleConfirmImport} disabled={importing || !importPreview.validCount}>
                {importing ? (
                  <><span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}></span>Importing...</>
                ) : (
                  <><Upload size={14} />Import {importPreview.validCount} Voters</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT CONFLICTS MODAL ── */}
      {conflictResponse && (
        <ConfirmModal
          isOpen={!!conflictResponse}
          onClose={() => setConflictResponse(null)}
          onConfirm={async () => {
            await handleImportWithStrategy('add');
          }}
          title="Duplicate Voter Records Found"
          confirmText="Overwrite / Add Voters"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-100)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 8 }}>
              <AlertTriangle size={18} style={{ color: 'var(--amber-500)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 700, color: 'var(--amber-800)', fontSize: 14 }}>Batch Import Conflict</p>
                <p style={{ fontSize: 13, color: 'var(--amber-700)', marginTop: 2 }}>
                  We detected {conflictResponse.conflicts.length} voter record(s) that conflict with existing name, reference ID, email, or telephone number.
                </p>
              </div>
            </div>

            {/* Scrollable conflicts list */}
            <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--navy-50)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              {conflictResponse.conflicts.map((c, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < conflictResponse.conflicts.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', fontSize: 12.5 }}>
                  <div style={{ color: 'var(--navy-900)', fontWeight: 700 }}>
                    {c.user.name} ({c.user.studentId})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 11, background: 'var(--red-50)', color: 'var(--red-700)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Reason: {c.reason}
                    </span>
                    <span style={{ fontSize: 11, background: 'var(--navy-100)', color: 'var(--navy-700)', padding: '1px 6px', borderRadius: 4 }}>
                      Existing: {c.existingUser.name} ({c.existingUser.studentId})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--navy-500)', lineHeight: 1.5 }}>
              Choose whether to overwrite/force add these voters, or skip (reject) the duplicate voter entries and import the remaining new records.
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, color: 'var(--red-600)', border: '1.5px solid var(--red-100)', background: 'var(--red-50)' }}
                onClick={async () => {
                  await handleImportWithStrategy('reject');
                }}
              >
                Reject & Skip Duplicates
              </button>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
