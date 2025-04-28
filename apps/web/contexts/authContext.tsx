"use client"
import { createContext, useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '../lib/api';
import jwt from 'jsonwebtoken';

interface User {
  id: string;
  username: string;
  type: string;
}

const AuthContext = createContext<{
  user: User | null;
  token: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; userData?: User; error?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signup: (username: string, password: string, type: "user" | "admin") => Promise<{ success: boolean; data?: any; error?: string }>;
  logout: () => void;
}>({
  user: null,
  token: "",
  isAuthenticated: false,
  isAdmin: false,
  loading: false,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setLoading(false);
    // Check for stored auth on load
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authAPI.signin(username, password);
      const { token: newToken } = response.data;
      setToken(newToken);
      const decoded = jwt.decode(newToken) as { userId: string, role: string };
      const userData = { id: decoded.userId, username, type: decoded.role };
      setUser(userData);

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true, userData };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  };

  const signup = async (username: string, password: string, type: "user" | "admin") => {
    try {
      const response = await authAPI.signup(username, password, type);
      console.log("Here",response);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Signup failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    isAdmin: user?.type === 'Admin',
    loading,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value= { value } >
      { children }
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;