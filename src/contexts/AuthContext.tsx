import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  phone?: string;
  avatar?: string;
  countryCode?: string;
  countryName?: string;
  countryFlag?: string;
  dialCode?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, phone?: string, countryCode?: string, countryName?: string, countryFlag?: string, dialCode?: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  updateBalance: (newBalance: number) => void;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'phone' | 'avatar'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = 'current_user';
  const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';

  export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const savedUser = localStorage.getItem(CURRENT_USER_KEY);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsLoading(false);
    }, []);

    const signIn = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          let err = 'Sign in failed';
          try { const e = await res.json(); if (e && e.error) err = e.error; } catch {}
          return { ok: false, error: err };
        }

        const data = await res.json();
        if (data.user) {
          const u: User = {
            id: data.user._id || data.user.id || '',
            email: data.user.email,
            name: data.user.name,
            balance: data.user.balance ?? 0,
            phone: data.user.phone ?? '',
            avatar: data.user.avatar ?? '',
            countryCode: data.user.countryCode ?? '',
            countryName: data.user.countryName ?? '',
            countryFlag: data.user.countryFlag ?? '',
            dialCode: data.user.dialCode ?? '',
          };
          setUser(u);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
          return { ok: true };
        }
        return { ok: false, error: 'Unexpected response' };
      } catch (err) {
        console.error('signIn error', err);
        return { ok: false, error: 'Server unreachable' };
      }
    };

    const signUp = async (
      email: string,
      password: string,
      name: string,
      phone?: string,
      countryCode?: string,
      countryName?: string,
      countryFlag?: string,
      dialCode?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, phone, countryCode, countryName, countryFlag, dialCode }),
        });

        if (!res.ok) {
          let err = 'Sign up failed';
          try { const e = await res.json(); if (e && e.error) err = e.error; } catch {}
          return { ok: false, error: err };
        }
        const data = await res.json();
        if (data.user) {
          const u: User = {
            id: data.user._id || data.user.id || '',
            email: data.user.email,
            name: data.user.name,
            balance: data.user.balance ?? 0,
            phone: data.user.phone ?? '',
            avatar: data.user.avatar ?? '',
            countryCode: data.user.countryCode ?? '',
            countryName: data.user.countryName ?? '',
            countryFlag: data.user.countryFlag ?? '',
            dialCode: data.user.dialCode ?? '',
          };
          setUser(u);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
          return { ok: true };
        }
        return { ok: false, error: 'Unexpected response' };
      } catch (err) {
        console.error('signUp error', err);
        return { ok: false, error: 'Server unreachable' };
      }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  const updateBalance = (newBalance: number) => {
    if (user) {
      const updatedUser = { ...user, balance: newBalance };
      setUser(updatedUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      // Optionally: persist balance to backend in future
    }
  };

  const updateProfile = (updates: Partial<Pick<User, 'name' | 'phone' | 'avatar'>>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      // Optionally: persist profile changes to backend in future
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, updateBalance, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
