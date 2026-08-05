/**
 * Auth context — holds the logged-in user and provides login/logout helpers.
 * Phase 1: Google OAuth via backend redirect + JWT in localStorage.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient, getToken, setToken, clearToken } from '../api/client.js';

const AuthContext = createContext(null);

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
      setUser(data.user);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  /** Store token received from OAuth callback and load user profile. */
  const loginWithToken = useCallback(
    async (token) => {
      setToken(token);
      setLoading(true);
      await fetchUser();
    },
    [fetchUser]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
