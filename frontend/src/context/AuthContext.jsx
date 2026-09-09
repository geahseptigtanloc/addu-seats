/**
 * Auth context for Google sessions and local demo-account previews.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient, clearToken, getToken, setToken } from '../api/client.js';
import { getDemoUser } from '../data/demoUsers.js';

const AuthContext = createContext(null);
const DEMO_ROLE_KEY = 'addu_seats_demo_role';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canUseProtectedApi, setCanUseProtectedApi] = useState(false);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(getDemoUser(localStorage.getItem(DEMO_ROLE_KEY)));
      setCanUseProtectedApi(false);
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient('/api/auth/me');
      setUser(data.user);
      setCanUseProtectedApi(true);
    } catch {
      clearToken();
      setUser(getDemoUser(localStorage.getItem(DEMO_ROLE_KEY)));
      setCanUseProtectedApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const loginWithToken = useCallback(
    async (token) => {
      localStorage.removeItem(DEMO_ROLE_KEY);
      setToken(token);
      setLoading(true);
      await fetchUser();
    },
    [fetchUser],
  );

  const loginAsDemo = useCallback(async (role) => {
    const fallbackUser = getDemoUser(role);
    if (!fallbackUser) throw new Error('Unknown demo role');

    clearToken();
    setLoading(true);

    try {
      const data = await apiClient('/api/auth/demo', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      localStorage.removeItem(DEMO_ROLE_KEY);
      setToken(data.token);
      setUser(data.user);
      setCanUseProtectedApi(true);
      return true;
    } catch {
      localStorage.setItem(DEMO_ROLE_KEY, role);
      setUser(fallbackUser);
      setCanUseProtectedApi(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(DEMO_ROLE_KEY);
    setUser(null);
    setCanUseProtectedApi(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        canUseProtectedApi,
        loginWithToken,
        loginAsDemo,
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
