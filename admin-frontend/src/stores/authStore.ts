import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
  email: string;
}

interface AuthState {
  token:    string | null;
  user:     AuthUser | null;
  isAuth:   boolean;
  login:    (token: string, user: AuthUser) => void;
  logout:   () => void;
  isAdmin:  () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:  null,
      user:   null,
      isAuth: false,

      login: (token, user) =>
        set({ token, user, isAuth: true }),

      logout: () => {
        set({ token: null, user: null, isAuth: false });
        localStorage.removeItem('aims-admin-auth');
      },

      isAdmin: () => {
        const role = get().user?.role ?? '';
        return ['Administrator', 'Super Admin'].includes(role);
      },
    }),
    { name: 'aims-admin-auth' }
  )
);
