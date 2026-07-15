import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes
const WARNING_BEFORE = 5 * 60 * 1000; // warn 5 min before

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loginError: null,
  sessionWarning: false,
  isLoading: false,
  isInitializing: true,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE_DONE':
      return { ...state, isInitializing: false };
    case 'LOGIN_START':
      return { ...state, isLoading: true, loginError: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loginError: null,
        isLoading: false,
        sessionWarning: false,
        isInitializing: false,
      };
    case 'LOGIN_ERROR':
      return { ...state, loginError: action.payload, isLoading: false, isInitializing: false };
    case 'LOGOUT':
      return { ...initialState, isInitializing: false };
    case 'SESSION_WARNING':
      return { ...state, sessionWarning: true };
    case 'SESSION_EXTEND':
      return { ...state, sessionWarning: false };
    case 'SWITCH_ROLE':
      return {
        ...state,
        user: { ...state.user, role: action.payload },
        sessionWarning: false,
      };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const activityRef = useRef(Date.now());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const startSessionTimer = useCallback(() => {
    clearTimers();
    warningRef.current = setTimeout(() => {
      dispatch({ type: 'SESSION_WARNING' });
    }, SESSION_TIMEOUT - WARNING_BEFORE);
    timeoutRef.current = setTimeout(() => {
      api.logout();
      dispatch({ type: 'LOGOUT' });
    }, SESSION_TIMEOUT);
  }, [clearTimers]);

  // Restore session on mount
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then(user => {
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
          startSessionTimer();
        })
        .catch(() => {
          api.logout();
          dispatch({ type: 'INITIALIZE_DONE' });
        });
    } else {
      dispatch({ type: 'INITIALIZE_DONE' });
    }
  }, []);

  const login = useCallback(async (studentId, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const data = await api.login(studentId, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: data.user, token: data.token } });
      startSessionTimer();
      return true;
    } catch (err) {
      dispatch({ type: 'LOGIN_ERROR', payload: err.message });
      return false;
    }
  }, [startSessionTimer]);

  const requestOtp = useCallback(async (studentId) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const data = await api.requestOtp(studentId);
      dispatch({ type: 'LOGIN_ERROR', payload: null }); // clear error, stop loading
      return data;
    } catch (err) {
      dispatch({ type: 'LOGIN_ERROR', payload: err.message });
      throw err;
    }
  }, []);

  const loginWithOtp = useCallback(async (studentId, otp) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const data = await api.verifyOtp(studentId, otp);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: data.user, token: data.token } });
      startSessionTimer();
      return true;
    } catch (err) {
      dispatch({ type: 'LOGIN_ERROR', payload: err.message });
      return false;
    }
  }, [startSessionTimer]);

  const logout = useCallback(() => {
    clearTimers();
    api.logout();
    dispatch({ type: 'LOGOUT' });
  }, [clearTimers]);

  const extendSession = useCallback(async () => {
    try {
      await api.refreshToken();
      dispatch({ type: 'SESSION_EXTEND' });
      startSessionTimer();
    } catch {
      logout();
    }
  }, [startSessionTimer, logout]);

  const switchRole = useCallback((role) => {
    if (import.meta.env.DEV) {
      dispatch({ type: 'SWITCH_ROLE', payload: role });
      startSessionTimer();
    } else {
      console.warn("Role switching is strictly disabled in production builds.");
    }
  }, [startSessionTimer]);

  const markVoted = useCallback((electionId) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: { hasVoted: [...(state.user?.hasVoted || []), electionId] },
    });
  }, [state.user]);

  // Reset timer on user activity
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const handleActivity = () => {
      const now = Date.now();
      if (now - activityRef.current > 10000) {
        activityRef.current = now;
        if (!state.sessionWarning) {
          startSessionTimer();
        }
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [state.isAuthenticated, state.sessionWarning]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const value = {
    ...state,
    login,
    requestOtp,
    loginWithOtp,
    logout,
    extendSession,
    switchRole,
    markVoted,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
