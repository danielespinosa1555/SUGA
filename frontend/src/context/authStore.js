import { create } from 'zustand';
import { authAPI } from '../services/api';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('suga_user') || 'null'),
  token: localStorage.getItem('suga_token') || null,
  loading: false,
  error: null,

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const res = await authAPI.login(credentials);
      const { token, user, requires2FA } = res.data;
      if (requires2FA) { set({ loading: false }); return { requires2FA: true }; }
      localStorage.setItem('suga_token', token);
      localStorage.setItem('suga_user', JSON.stringify(user));
      set({ token, user, loading: false });
      return { success: true, user };
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión';
      set({ error: msg, loading: false });
      return { error: msg };
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await authAPI.register(data);
      const { token, user } = res.data;
      localStorage.setItem('suga_token', token);
      localStorage.setItem('suga_user', JSON.stringify(user));
      set({ token, user, loading: false });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar';
      set({ error: msg, loading: false });
      return { error: msg };
    }
  },

  logout: () => {
    localStorage.removeItem('suga_token');
    localStorage.removeItem('suga_user');
    set({ user: null, token: null, error: null });
  },

  refreshUser: async () => {
    try {
      const res = await authAPI.getMe();
      const user = res.data;
      localStorage.setItem('suga_user', JSON.stringify(user));
      set({ user });
      return user;
    } catch (_) {
      get().logout();
      return null;
    }
  },

  clearError: () => set({ error: null }),
  isAdmin: () => get().user?.role === 'admin',
}));

export default useAuthStore;
