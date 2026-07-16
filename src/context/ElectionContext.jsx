import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ElectionContext = createContext(null);

const initialState = {
  elections: [],
  candidates: [],
  auditLogs: [],
  voteRecords: [],
  departments: [],
  users: [],
  announcements: [],
  anomalies: [],
  toasts: [],
  notifications: [],
  unreadNotificationsCount: 0,
  loading: true,
};

function electionReducer(state, action) {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, ...action.payload, loading: false };
    case 'SET_ELECTIONS':
      return { ...state, elections: action.payload };
    case 'SET_CANDIDATES':
      return { ...state, candidates: action.payload };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_ANNOUNCEMENTS':
      return { ...state, announcements: action.payload };
    case 'SET_AUDIT_LOGS':
      return { ...state, auditLogs: action.payload };
    case 'SET_VOTE_RECORDS':
      return { ...state, voteRecords: action.payload };
    case 'SET_ANOMALIES':
      return { ...state, anomalies: action.payload };
    case 'UPDATE_ELECTION':
      return { ...state, elections: state.elections.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'ADD_ELECTION':
      return { ...state, elections: [...state.elections, action.payload] };
    case 'ADD_CANDIDATE':
      return { ...state, candidates: [...state.candidates, action.payload] };
    case 'UPDATE_CANDIDATE_IN_LIST':
      return { ...state, candidates: state.candidates.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'REMOVE_CANDIDATE':
      return { ...state, candidates: state.candidates.filter(c => c.id !== action.payload) };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] };
    case 'UPDATE_USER_IN_LIST':
      return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
    case 'REMOVE_USER':
      return { ...state, users: state.users.filter(u => u.id !== action.payload) };
    case 'ADD_ANNOUNCEMENT':
      return { ...state, announcements: [action.payload, ...state.announcements] };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, { id: Date.now(), ...action.payload }] };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'SET_UNREAD_COUNT':
      return { ...state, unreadNotificationsCount: action.payload };
    case 'MARK_NOTIF_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n),
        unreadNotificationsCount: Math.max(0, state.unreadNotificationsCount - 1)
      };
    case 'MARK_ALL_NOTIFS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadNotificationsCount: 0
      };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    default:
      return state;
  }
}


export function ElectionProvider({ children }) {
  const [state, dispatch] = useReducer(electionReducer, initialState);
  const { isAuthenticated, user } = useAuth();

  // ─── Fetch all data when authenticated ───
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        const [elections, candidates, departments] = await Promise.all([
          api.getElections(),
          api.getCandidates(),
          api.getDepartments(),
        ]);

        let auditLogs = [];
        let users = [];
        let announcements = [];
        let voteRecords = [];
        let anomalies = [];
        let notifications = [];
        let unreadCount = 0;

        if (user?.role === 'admin' || user?.role === 'auditor') {
          [auditLogs, announcements, voteRecords, anomalies] = await Promise.all([
            api.getAuditLogs(),
            api.getAnnouncements(),
            api.getVoteRecords().catch(() => []),
            api.getAnomalies().catch(() => []),
          ]);
        }
        if (user?.role === 'admin') {
          users = await api.getUsers().catch(() => []);
        }

        // Fetch notifications for all roles (voters, admins, auditors)
        try {
          notifications = await api.getNotifications();
          const countRes = await api.getUnreadNotificationsCount();
          unreadCount = countRes.count;
        } catch (e) {
          console.error('Failed to load notifications:', e);
        }

        dispatch({
          type: 'SET_DATA',
          payload: {
            elections,
            candidates,
            departments,
            auditLogs,
            users,
            announcements,
            voteRecords,
            anomalies,
            notifications,
            unreadNotificationsCount: unreadCount
          },
        });
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        dispatch({ type: 'SET_DATA', payload: {} });
      }
    };

    fetchData();

    // Set up brief polling for unread notifications count and election statuses (every 30s)
    const interval = setInterval(async () => {
      try {
        const countRes = await api.getUnreadNotificationsCount();
        dispatch({ type: 'SET_UNREAD_COUNT', payload: countRes.count });

        // Dynamic synchronization for auto-closing/updating elections
        const elections = await api.getElections();
        dispatch({ type: 'SET_ELECTIONS', payload: elections });
      } catch (e) { }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user?.role]);

  // ─── Actions that call the API ───

  const castVote = useCallback(async (electionId, candidateIdOrIds, departmentId) => {
    const candidateIds = Array.isArray(candidateIdOrIds) ? candidateIdOrIds : [candidateIdOrIds];
    const result = await api.castVote(electionId, candidateIds);
    // Refresh elections and candidates
    const [elections, candidates] = await Promise.all([api.getElections(), api.getCandidates()]);
    dispatch({ type: 'SET_ELECTIONS', payload: elections });
    dispatch({ type: 'SET_CANDIDATES', payload: candidates });
    return result;
  }, []);

  const verifyBlockchain = useCallback(async () => {
    return await api.verifyBlockchain();
  }, []);

  const addElectionCategory = useCallback(async (electionId, category) => {
    const updated = await api.addElectionCategory(electionId, category);
    dispatch({ type: 'UPDATE_ELECTION', payload: updated });
  }, []);

  const createElection = useCallback(async (electionData) => {
    const created = await api.createElection(electionData);
    dispatch({ type: 'ADD_ELECTION', payload: created });
    return created;
  }, []);

  const updateElection = useCallback(async (electionData) => {
    const { id, ...data } = electionData;
    const updated = await api.updateElection(id, data);
    dispatch({ type: 'UPDATE_ELECTION', payload: updated });
  }, []);

  const addCandidate = useCallback(async (candidateData) => {
    const created = await api.createCandidate(candidateData);
    dispatch({ type: 'ADD_CANDIDATE', payload: created });
    return created;
  }, []);

  const updateCandidate = useCallback(async (candidateId, candidateData) => {
    const updated = await api.updateCandidate(candidateId, candidateData);
    dispatch({ type: 'UPDATE_CANDIDATE_IN_LIST', payload: updated });
    return updated;
  }, []);

  const deleteCandidate = useCallback(async (candidateId) => {
    await api.deleteCandidate(candidateId);
    dispatch({ type: 'REMOVE_CANDIDATE', payload: candidateId });
  }, []);

  const deleteElectionCategory = useCallback(async (electionId, category) => {
    const updated = await api.deleteElectionCategory(electionId, category);
    dispatch({ type: 'UPDATE_ELECTION', payload: updated });
    // Remove candidates for this category locally
    const candidates = await api.getCandidates();
    dispatch({ type: 'SET_CANDIDATES', payload: candidates });
  }, []);

  const addToast = useCallback((toast) => {
    const id = Date.now();
    dispatch({ type: 'ADD_TOAST', payload: { ...toast, id } });
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const addUser = useCallback(async (userData) => {
    const created = await api.createUser(userData);
    dispatch({ type: 'ADD_USER', payload: created });
    return created;
  }, []);

  const updateUser = useCallback(async (userData) => {
    const { id, ...data } = userData;
    const updated = await api.updateUser(id, data);
    dispatch({ type: 'UPDATE_USER_IN_LIST', payload: updated });
  }, []);

  const deleteUser = useCallback(async (id) => {
    await api.deleteUser(id);
    dispatch({ type: 'REMOVE_USER', payload: id });
  }, []);

  const importUsers = useCallback(async (usersList, resolveStrategy) => {
    const res = await api.importUsers(usersList, resolveStrategy);
    const users = await api.getUsers();
    dispatch({ type: 'SET_USERS', payload: users });
    return res;
  }, []);

  const clearVoterRegistry = useCallback(async (year, password) => {
    const res = await api.clearVoterRegistry(year, password);
    const users = await api.getUsers();
    dispatch({ type: 'SET_USERS', payload: users });
    return res;
  }, []);

  const addAnnouncement = useCallback(async (announcementData) => {
    const created = await api.createAnnouncement(announcementData);
    dispatch({ type: 'ADD_ANNOUNCEMENT', payload: created });
    return created;
  }, []);

  const createDepartment = useCallback(async (deptData) => {
    const created = await api.createDepartment(deptData);
    const depts = await api.getDepartments();
    dispatch({ type: 'SET_DATA', payload: { departments: depts } });
    return created;
  }, []);

  const updateDepartment = useCallback(async (id, deptData) => {
    const updated = await api.updateDepartment(id, deptData);
    const depts = await api.getDepartments();
    dispatch({ type: 'SET_DATA', payload: { departments: depts } });
    return updated;
  }, []);

  const clearAnomaly = useCallback(async (id) => {
    await api.clearAnomaly(id);
    const anomalies = await api.getAnomalies().catch(() => []);
    dispatch({ type: 'SET_ANOMALIES', payload: anomalies });
    const auditLogs = await api.getAuditLogs().catch(() => []);
    dispatch({ type: 'SET_AUDIT_LOGS', payload: auditLogs });
  }, []);

  const getElectionCandidates = useCallback((electionId) => {
    return state.candidates.filter(c => c.electionId === electionId);
  }, [state.candidates]);

  const getElectionById = useCallback((electionId) => {
    return state.elections.find(e => e.id === electionId);
  }, [state.elections]);

  const getDepartmentById = useCallback((deptId) => {
    return state.departments.find(d => d.id === deptId);
  }, [state.departments]);

  const value = {
    ...state,
    castVote,
    verifyBlockchain,
    addElectionCategory,
    createElection,
    updateElection,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    deleteElectionCategory,
    addToast,
    removeToast,
    getElectionCandidates,
    getElectionById,
    getDepartmentById,
    addUser,
    updateUser,
    deleteUser,
    importUsers,
    clearVoterRegistry,
    addAnnouncement,
    createDepartment,
    updateDepartment,
    clearAnomaly,
    fetchNotifications: async () => {
      try {
        const list = await api.getNotifications();
        dispatch({ type: 'SET_NOTIFICATIONS', payload: list });
        const countRes = await api.getUnreadNotificationsCount();
        dispatch({ type: 'SET_UNREAD_COUNT', payload: countRes.count });
      } catch (e) { }
    },
    markNotificationRead: async (id) => {
      try {
        await api.markNotificationRead(id);
        dispatch({ type: 'MARK_NOTIF_READ', payload: id });
      } catch (e) { }
    },
    markAllNotificationsRead: async () => {
      try {
        await api.markAllNotificationsRead();
        dispatch({ type: 'MARK_ALL_NOTIFS_READ' });
      } catch (e) { }
    }
  };

  return <ElectionContext.Provider value={value}>{children}</ElectionContext.Provider>;
}

export function useElection() {
  const context = useContext(ElectionContext);
  if (!context) throw new Error('useElection must be used within ElectionProvider');
  return context;
}
