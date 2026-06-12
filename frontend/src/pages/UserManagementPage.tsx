import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI } from '../services/api';
import { User, ROLE_LABELS } from '../types';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Users,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Lock,
  Eye,
  Trash2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  Activity,
  X,
  CheckSquare,
  Loader2
} from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'Viewer',
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, [page, search, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await usersAPI.list({
        page,
        limit,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined
      });
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      setError('Failed to retrieve user registry records.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      await usersAPI.create(createForm);
      setSuccess(`User account '${createForm.username}' created successfully.`);
      setCreateForm({ username: '', email: '', full_name: '', password: '', role: 'Viewer' });
      setShowCreateForm(false);
      setPage(1);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user account.');
    } finally {
      setCreating(false);
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: string) => {
    setError('');
    setSuccess('');
    const nextStatus = currentStatus === 'Enabled' ? 'Disabled' : 'Enabled';
    try {
      const res = await usersAPI.toggleStatus(userId, nextStatus);
      setSuccess(`User status successfully updated to ${nextStatus}.`);
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(res.data);
      }
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle user account status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setResetting(true);
    setError('');
    setSuccess('');
    try {
      await usersAPI.resetPassword(selectedUser.id, newPassword);
      setSuccess(`Password for user '${selectedUser.username}' has been successfully reset.`);
      setNewPassword('');
      setShowPasswordResetModal(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user account '${username}'?`)) return;
    setError('');
    setSuccess('');
    try {
      await usersAPI.delete(userId);
      setSuccess(`User account '${username}' successfully deleted.`);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user account.');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto pb-12 font-sans"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">Identity & Access Management (IAM)</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage user roles, audit logon logs, disable/enable profiles, and enforce access restrictions.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs active:scale-95 transition-all shadow-md shadow-[#2563EB]/15"
        >
          <UserPlus size={14} />
          {showCreateForm ? 'Cancel Creation' : 'Add New User'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-700 flex items-center gap-2">
          <CheckSquare size={14} />
          {success}
        </div>
      )}

      {/* CREATE NEW USER FORM */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-6 border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm"
          >
            <h2 className="text-xs font-extrabold text-[#2E4265] uppercase tracking-wider mb-4">Create New Profile</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
              <div>
                <label className="block text-gray-600 mb-1">Username</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="input-field rounded-xl border border-gray-200 text-xs py-2 px-3 w-full font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Email Address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="input-field rounded-xl border border-gray-200 text-xs py-2 px-3 w-full font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="input-field rounded-xl border border-gray-200 text-xs py-2 px-3 w-full font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Temporary Password</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="input-field rounded-xl border border-gray-200 text-xs py-2 px-3 w-full font-medium"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Governance Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="select-field rounded-xl border border-gray-200 text-xs py-2 px-3 w-full font-medium bg-white"
                >
                  {Object.keys(ROLE_LABELS).map((roleKey) => (
                    <option key={roleKey} value={roleKey}>{ROLE_LABELS[roleKey]}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary w-full py-2.5 rounded-xl font-bold text-xs"
                >
                  {creating ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Create User Account'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER PANEL */}
      <div className="p-4 bg-white border border-[#E2E8F0] rounded-[24px] shadow-sm flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search accounts by username, name, or email..."
            className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="select-field text-xs py-2 px-3 border border-gray-200 rounded-xl bg-white w-full sm:w-36 font-semibold"
          >
            <option value="">All Roles</option>
            {Object.keys(ROLE_LABELS).map((k) => (
              <option key={k} value={k}>{ROLE_LABELS[k]}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="select-field text-xs py-2 px-3 border border-gray-200 rounded-xl bg-white w-full sm:w-36 font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="Enabled">Enabled</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* TABLE AND USER LIST */}
      {loading ? (
        <div className="py-12">
          <LoadingSpinner message="Searching accounts list..." />
        </div>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center border border-[#E2E8F0] rounded-[24px] bg-white">
          <Users className="mx-auto text-gray-300 mb-3" size={36} />
          <p className="text-xs text-gray-500 font-bold">No user accounts found matching your filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden border border-[#E2E8F0] rounded-[24px] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                  <th className="px-4 py-3">User Profile</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Logins</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-gray-600">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A]">{u.full_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100 bg-blue-50 text-blue-700">
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        u.status === 'Enabled' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'
                      }`}>
                        {u.status || (u.is_active ? 'Enabled' : 'Disabled')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-gray-700">
                      {u.total_logins || 0}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[10px]">
                      {u.last_login ? formatDate(u.last_login) : 'Never Logged In'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="p-1 hover:text-blue-600 text-gray-400 transition-colors"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        
                        <button
                          onClick={() => toggleUserStatus(u.id, u.status || (u.is_active ? 'Enabled' : 'Disabled'))}
                          className={`p-1 transition-colors ${u.status === 'Enabled' ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                          title={u.status === 'Enabled' ? 'Disable Account' : 'Enable Account'}
                        >
                          {u.status === 'Enabled' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
            <span>
              Showing Page {page} of {totalPages} ({total} total accounts)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER DETAIL MODAL OVERLAY */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-[24px] p-6 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Shield size={14} className="text-[#2563EB]" />
                  <h3 className="text-[#0F172A] uppercase tracking-wider">Account Governance Profile</h3>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Details view */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-100 rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                    {selectedUser.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-[#0F172A]">{selectedUser.full_name}</h4>
                    <p className="text-gray-400 font-mono">@{selectedUser.username}</p>
                  </div>
                </div>

                <div className="space-y-2 p-3 border border-gray-100 rounded-2xl font-semibold text-gray-500">
                  <div className="flex justify-between">
                    <span>Email Address:</span>
                    <span className="text-gray-700 font-bold">{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Role:</span>
                    <span className="text-[#2563EB] font-bold">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={`font-bold ${selectedUser.status === 'Enabled' ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedUser.status || (selectedUser.is_active ? 'Enabled' : 'Disabled')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Logins:</span>
                    <span className="text-gray-700 font-mono font-bold">{selectedUser.total_logins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Login:</span>
                    <span className="text-gray-700 font-bold">{selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Password Change:</span>
                    <span className={`font-bold ${selectedUser.must_change_password ? 'text-amber-600' : 'text-gray-400'}`}>
                      {selectedUser.must_change_password ? 'Required on Login' : 'Cleared'}
                    </span>
                  </div>
                </div>

                {/* Reset Password Action block */}
                {showPasswordResetModal ? (
                  <form onSubmit={handleResetPassword} className="space-y-2 border border-[#E2E8F0] p-3 rounded-xl bg-amber-50/20">
                    <span className="text-[10px] font-bold text-amber-700 block">Enforce Password Override</span>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Type new secure password..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field text-xs py-1.5 px-3 border border-gray-200 rounded-lg flex-1"
                        required
                        minLength={6}
                      />
                      <button
                        type="submit"
                        disabled={resetting}
                        className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-bold text-[10px]"
                      >
                        {resetting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPasswordResetModal(true)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-blue-200 text-[#2563EB] bg-blue-50/50 hover:bg-blue-50 rounded-xl font-bold"
                    >
                      <Lock size={12} />
                      Reset Password
                    </button>

                    <button
                      onClick={() => toggleUserStatus(selectedUser.id, selectedUser.status || (selectedUser.is_active ? 'Enabled' : 'Disabled'))}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded-xl font-bold"
                    >
                      <Activity size={12} />
                      {selectedUser.status === 'Enabled' ? 'Disable Account' : 'Enable Account'}
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-100 flex justify-between gap-2">
                  <button
                    onClick={() => deleteUser(selectedUser.id, selectedUser.username)}
                    disabled={selectedUser.role === 'Administrator'}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    Delete User
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
