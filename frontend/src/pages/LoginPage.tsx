import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForceChange, setShowForceChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);
  
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(username, password);
      const user = res.data.user;
      const token = res.data.access_token;
      
      if (user.must_change_password) {
        // Hold the session token in local storage temporarily to authenticate changePassword API call
        localStorage.setItem('token', token);
        setTempToken(token);
        setTempUser(user);
        setShowForceChange(true);
      } else {
        login(user, token);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.changePassword(newPassword);
      // Clean up temp store and login completely
      login(res.data, tempToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155] p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/3 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Glass card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-[24px] shadow-2xl p-8 border border-white/10 text-white">
          
          {/* Forced Password Change View */}
          <AnimatePresence mode="wait">
            {showForceChange ? (
              <motion.div
                key="force-change"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 text-white text-2xl font-bold mb-4 shadow-lg">
                    🔒
                  </div>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    Reset Initial Password
                  </h1>
                  <p className="text-xs text-slate-300 mt-2">
                    For enterprise security compliance, please update your temporary password before proceeding.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-slate-300 uppercase mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400 focus:outline-none text-white text-sm font-semibold transition-all"
                      placeholder="Enter new password"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold tracking-wider text-slate-300 uppercase mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-amber-400 focus:outline-none text-white text-sm font-semibold transition-all"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-95"
                  >
                    {loading ? <LoadingSpinner size="sm" message="" /> : 'Update Password & Continue'}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Logo */}
                <div className="text-center mb-8">
                  <motion.div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white text-xl font-black mb-4 shadow-lg border border-blue-400/20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  >
                    AIMS
                  </motion.div>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    Sign In
                  </h1>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Enterprise Asset Governance & Reconciliation Platform
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-300">
                    {error}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  <div>
                    <label htmlFor="username" className="block text-xs font-bold tracking-wider text-slate-300 uppercase mb-1.5">
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-white text-sm font-semibold transition-all"
                      placeholder="Enter username"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-bold tracking-wider text-slate-300 uppercase mb-1.5">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-white text-sm font-semibold transition-all"
                      placeholder="Enter password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !username || !password}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#2563EB]/15 active:scale-95"
                  >
                    {loading ? <LoadingSpinner size="sm" message="" /> : 'Sign In'}
                  </button>
                </form>

                <p className="text-center text-[10px] text-slate-400 mt-6">
                  Please consult system support for account activation profiles
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-500 mt-4 font-mono">
          AIMS Platform v1.0 · Secured Session
        </p>
      </motion.div>
    </div>
  );
}
