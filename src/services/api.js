// ============================================
// API SERVICE — Frontend HTTP client for UniVote Backend
// ============================================

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    // If running in browser and served from same domain (or a custom production port/domain)
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

const API_BASE = getApiBase();

class ApiService {
  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('univote_token') : null;
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('univote_token', token);
      } else {
        localStorage.removeItem('univote_token');
      }
    }
  }

  getToken() {
    return this.token;
  }

  getUrl(path) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const base = API_BASE.replace(/\/api$/, '');
    return `${base}${cleanPath}`;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // If body is FormData, remove Content-Type so browser sets it with boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const res = await fetch(url, {
      ...options,
      headers,
      body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = new Error(data?.error || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.code = data?.code;
      error.data = data;
      throw error;
    }

    return data;
  }

  // ── Auth ──
  async login(studentId, password) {
    const data = await this.request('/auth/login', {
      body: { studentId, password },
      method: 'POST',
    });
    this.setToken(data.token);
    return data;
  }

  async refreshToken() {
    const data = await this.request('/auth/refresh', { method: 'POST' });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    });
  }

  async requestOtp(studentId) {
    return this.request('/auth/request-otp', {
      method: 'POST',
      body: { studentId },
    });
  }

  async verifyOtp(studentId, otp) {
    const data = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: { studentId, otp },
    });
    this.setToken(data.token);
    return data;
  }

  async agentLogin(passcode) {
    const data = await this.request('/auth/agent/login', {
      method: 'POST',
      body: { passcode },
    });
    this.setToken(data.token);
    return data;
  }

  // ── Elections ──
  async getElections() {
    return this.request('/elections');
  }

  async getElection(id) {
    return this.request(`/elections/${id}`);
  }

  async createElection(data) {
    return this.request('/elections', { method: 'POST', body: data });
  }

  async updateElection(id, data) {
    return this.request(`/elections/${id}`, { method: 'PATCH', body: data });
  }

  async addElectionCategory(electionId, name) {
    return this.request(`/elections/${electionId}/categories`, { method: 'POST', body: { name } });
  }

  async deleteElectionCategory(electionId, name) {
    return this.request(`/elections/${electionId}/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  // ── Candidates ──
  async getCandidates(electionId) {
    const query = electionId ? `?electionId=${electionId}` : '';
    return this.request(`/candidates${query}`);
  }

  async createCandidate(data) {
    return this.request('/candidates', { method: 'POST', body: data });
  }

  async deleteCandidate(id) {
    return this.request(`/candidates/${id}`, { method: 'DELETE' });
  }

  // ── Votes ──
  async castVote(electionId, candidateIds) {
    return this.request('/votes/cast', { method: 'POST', body: { electionId, candidateIds } });
  }

  async getVoteRecords(electionId) {
    const query = electionId ? `?electionId=${electionId}` : '';
    return this.request(`/votes/records${query}`);
  }

  async checkVoted(electionId) {
    return this.request(`/votes/check/${electionId}`);
  }

  async verifyBlockchain() {
    return this.request('/votes/blockchain/verify');
  }

  async getTurnoutStats() {
    return this.request('/votes/stats/turnout');
  }

  async getPublicLiveStats(electionId) {
    return this.request(`/votes/public-live/${electionId}`);
  }

  async getTimelineStats() {
    return this.request('/votes/stats/timeline');
  }

  // ── Users ──
  async getUsers(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/users${query}`);
  }

  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  async createUser(data) {
    return this.request('/users', { method: 'POST', body: data });
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, { method: 'PATCH', body: data });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  async importUsers(users, resolveStrategy) {
    return this.request('/users/import', { method: 'POST', body: { users, resolveStrategy } });
  }

  async clearVoterRegistry(year, password) {
    const url = year ? `/users/clear/voters?year=${encodeURIComponent(year)}` : '/users/clear/voters';
    return this.request(url, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': password }
    });
  }

  // ── Departments ──
  async getDepartments() {
    return this.request('/departments');
  }

  async createDepartment(data) {
    return this.request('/departments', { method: 'POST', body: data });
  }

  async updateDepartment(id, data) {
    return this.request(`/departments/${id}`, { method: 'PATCH', body: data });
  }

  // ── Audit Logs ──
  async getAuditLogs(limit = 200) {
    return this.request(`/audit-logs?limit=${limit}`);
  }

  async getAnomalies() {
    return this.request('/audit-logs/anomalies');
  }

  async clearAnomaly(id) {
    return this.request(`/audit-logs/anomalies/${id}/clear`, { method: 'POST' });
  }

  // ── Announcements ──
  async getAnnouncements() {
    return this.request('/announcements');
  }

  async createAnnouncement(data) {
    return this.request('/announcements', { method: 'POST', body: data });
  }

  // ── Notifications ──
  async getNotifications(limit = 50) {
    return this.request(`/notifications?limit=${limit}`);
  }

  async getUnreadNotificationsCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  // ── Cryptographic Health Checks ──
  async runCryptographicHealthChecks() {
    return this.request('/health-checks/all');
  }

  // ── Server Time ──
  async getServerTime() {
    return this.request('/time');
  }
}

// Singleton instance
const api = new ApiService();
export default api;
