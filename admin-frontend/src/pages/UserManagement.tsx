import { useEffect, useState, useCallback } from 'react';
import { Users, Search, RefreshCw, Pencil, Trash2, KeyRound, UserCheck, UserX, Shield } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { type AdminUser } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    'Super Admin':   'badge-purple',
    'Administrator': 'badge-blue',
    'Analyst':       'badge-green',
    'Auditor':       'badge-amber',
    'Viewer':        'badge-red',
  };
  return <span className={map[role] ?? 'badge-blue'}>{role}</span>;
}

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="badge-green"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Enabled</span>
    : <span className="badge-red"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Disabled</span>;
}

export default function UserManagement() {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRole]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [modal, setModal]       = useState<'view' | 'edit' | 'reset' | null>(null);
  const [newPwd, setNewPwd]     = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getUsers({ page, limit: 15, search, role: roleFilter || undefined });
      setUsers(r.data.users);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(u: AdminUser) {
    const newActive = !u.is_active;
    await adminApi.updateUser(u.id, { is_active: newActive, status: newActive ? 'Enabled' : 'Disabled' });
    setMsg(`${u.username} ${newActive ? 'enabled' : 'disabled'}`);
    load();
  }
  async function handleDelete(u: AdminUser) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    await adminApi.deleteUser(u.id);
    setMsg(`User ${u.username} deleted`);
    load();
  }
  async function handleReset() {
    if (!selected || newPwd.length < 6) return;
    setSaving(true);
    await adminApi.resetPassword(selected.id, newPwd);
    setSaving(false); setModal(null); setNewPwd('');
    setMsg('Password reset successfully');
  }
  async function handleEdit() {
    if (!selected) return;
    setSaving(true);
    await adminApi.updateUser(selected.id, { role: editRole, status: editStatus, is_active: editStatus === 'Enabled' });
    setSaving(false); setModal(null);
    setMsg('User updated'); load();
  }

  const roles = ['Administrator', 'Analyst', 'Auditor', 'Viewer'];
  const pageCount = Math.ceil(total / 15);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{total} users in the system</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} />Refresh</button>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 flex items-center justify-between">
          {msg} <button onClick={() => setMsg('')} className="text-emerald-600 hover:text-emerald-400">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="admin-input pl-9 w-full"
            placeholder="Search username, email, name…"
          />
        </div>
        <select value={roleFilter} onChange={e => { setRole(e.target.value); setPage(1); }} className="admin-select w-40">
          <option value="">All Roles</option>
          {['Super Admin', 'Administrator', 'Analyst', 'Auditor', 'Viewer'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th><th>Role</th><th>Status</th>
                  <th>Logins</th><th>Created</th><th>Last Login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold uppercase">
                          {u.username[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{u.username}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><StatusBadge active={u.is_active} /></td>
                    <td className="text-slate-400">{u.total_logins}</td>
                    <td className="text-slate-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="text-slate-500 text-xs">{u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost" onClick={() => { setSelected(u); setModal('view'); }}>
                          <Users size={12} /> View
                        </button>
                        <button className="btn-ghost" onClick={() => { setSelected(u); setEditRole(u.role); setEditStatus(u.status); setModal('edit'); }}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button className="btn-ghost" onClick={() => { setSelected(u); setModal('reset'); }}>
                          <KeyRound size={12} />
                        </button>
                        <button className="btn-ghost" onClick={() => toggleStatus(u)} title={u.is_active ? 'Disable' : 'Enable'}>
                          {u.is_active ? <UserX size={12} className="text-red-400" /> : <UserCheck size={12} className="text-emerald-400" />}
                        </button>
                        <button className="btn-ghost text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(u)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-12">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">Page {page} of {pageCount} · {total} total</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-5">
            {modal === 'view' && (
              <>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield size={18} />{selected.username}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Full Name', selected.full_name],
                    ['Email', selected.email],
                    ['Role', selected.role],
                    ['Status', selected.status],
                    ['Total Logins', String(selected.total_logins)],
                    ['Uploads', String(selected.stats?.uploads ?? 0)],
                    ['Reconciliations', String(selected.stats?.reconciliations ?? 0)],
                    ['Reports', String(selected.stats?.reports ?? 0)],
                  ].map(([k, v]) => (
                    <div key={k} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-slate-500">{k}</p>
                      <p className="text-sm font-medium text-white mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary w-full justify-center" onClick={() => setModal(null)}>Close</button>
              </>
            )}
            {modal === 'edit' && (
              <>
                <h3 className="text-lg font-bold text-white">Edit User: {selected.username}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Role</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} className="admin-select w-full">
                      {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="admin-select w-full">
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 justify-center" onClick={handleEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button className="btn-secondary flex-1 justify-center" onClick={() => setModal(null)}>Cancel</button>
                </div>
              </>
            )}
            {modal === 'reset' && (
              <>
                <h3 className="text-lg font-bold text-white">Reset Password: {selected.username}</h3>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="admin-input w-full" placeholder="New password (min 6 chars)" />
                <div className="flex gap-2">
                  <button className="btn-danger flex-1 justify-center" onClick={handleReset} disabled={saving || newPwd.length < 6}>
                    {saving ? 'Resetting…' : 'Reset Password'}
                  </button>
                  <button className="btn-secondary flex-1 justify-center" onClick={() => setModal(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
