import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  changePassword: (newPassword: string) =>
    api.post('/auth/change-password', { new_password: newPassword }),
};

// Users
export const usersAPI = {
  list: (params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) =>
    api.get('/users/', { params }),
  create: (data: { username: string; email: string; full_name: string; password: string; role: string }) =>
    api.post('/users/', data),
  get: (id: number) => api.get(`/users/${id}`),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  resetPassword: (id: number, password: string) =>
    api.post(`/users/${id}/reset-password`, { new_password: password }),
  toggleStatus: (id: number, status: string) =>
    api.post(`/users/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// Inventory
export const inventoryAPI = {
  uploadCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/inventory/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadJSON: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/inventory/upload-json', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  listUploads: (type?: string) =>
    api.get('/inventory/uploads', { params: type ? { upload_type: type } : {} }),
  reconcile: (csv_upload_id: number, json_upload_id: number) =>
    api.post('/inventory/reconcile', { csv_upload_id, json_upload_id }),
  getReconciliation: (id: number) => api.get(`/inventory/reconciliations/${id}`),
  listReconciliations: () => api.get('/inventory/reconciliations'),
  chatbot: (query: string, reconciliation_id?: number) =>
    api.post('/inventory/chatbot', { query, reconciliation_id }),
  resetWorkspace: () => api.post('/inventory/reset-workspace'),
};

// Reports
export const reportsAPI = {
  generate: (reconId: number) => api.post(`/reports/generate/${reconId}`),
  download: (reportId: number) =>
    api.get(`/reports/download/${reportId}`, { responseType: 'blob' }),
  list: () => api.get('/reports/'),
};

// Audit
export const auditAPI = {
  getLogs: (params?: { skip?: number; limit?: number; user_id?: number; action_category?: string }) =>
    api.get('/audit/logs', { params }),
};

export default api;
