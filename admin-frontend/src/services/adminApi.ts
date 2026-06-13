import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const adminApi = {
  // Auth
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),

  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),

  // Users
  getUsers: (params?: Record<string, unknown>) =>
    api.get('/admin/users', { params }),
  getUser: (id: number) => api.get(`/admin/users/${id}`),
  updateUser: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  resetPassword: (id: number, newPassword: string) =>
    api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword }),

  // Analytics
  getUserAnalytics: () => api.get('/admin/user-analytics'),
  getGeminiAnalytics: (days?: number) =>
    api.get('/admin/gemini-analytics', { params: { days: days ?? 30 } }),
  getApiAnalytics: (days?: number) =>
    api.get('/admin/api-analytics', { params: { days: days ?? 7 } }),

  // Inventory
  getAssets: (params?: Record<string, unknown>) =>
    api.get('/admin/assets', { params }),
  deleteAsset: (id: number) => api.delete(`/admin/assets/${id}`),

  // Reconciliations
  getReconciliations: (params?: Record<string, unknown>) =>
    api.get('/admin/reconciliations', { params }),
  deleteReconciliation: (id: number) =>
    api.delete(`/admin/reconciliations/${id}`),

  // Reports
  getReports: (params?: Record<string, unknown>) =>
    api.get('/admin/reports', { params }),
  deleteReport: (id: number) => api.delete(`/admin/reports/${id}`),

  // Audit
  getAuditLogs: (params?: Record<string, unknown>) =>
    api.get('/admin/audit-logs', { params }),

  // System
  getDatabaseHealth: () => api.get('/admin/database-health'),
  getSystemHealth:   () => api.get('/admin/system-health'),
  getSecurity:       (days?: number) =>
    api.get('/admin/security', { params: { days: days ?? 30 } }),
  getBusinessIntelligence: () => api.get('/admin/business-intelligence'),
};
