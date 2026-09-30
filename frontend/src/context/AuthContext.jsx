/**
 * Auth context for real Google OAuth sessions.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient, clearToken, getToken, setToken } from '../api/client.js';
import { normalizeUser } from '../api/normalizers.js';

const AuthContext = createContext(null);
const LEGACY_DEMO_KEYS = ['addu_seats_demo_role', 'addu_seats_demo_reservation'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient('/api/auth/me');
      setUser(normalizeUser(data.user));
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    LEGACY_DEMO_KEYS.forEach((key) => localStorage.removeItem(key));
    fetchUser();
  }, [fetchUser]);

  const loginWithToken = useCallback(
    async (token) => {
      setToken(token);
      setLoading(true);
      await fetchUser();
    },
    [fetchUser],
  );

  const logout = useCallback(() => {
    clearToken();
    LEGACY_DEMO_KEYS.forEach((key) => localStorage.removeItem(key));
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithToken,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
