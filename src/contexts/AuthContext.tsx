import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  suspended?: boolean;
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
  signIn: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    name: string,
    phone?: string,
    countryCode?: string,
    countryName?: string,
    countryFlag?: string,
    dialCode?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  refreshBalance: () => Promise<void>;
  updateBalance: (newBalance: number) => void;
  updateProfile: (updates: Partial<Pick<User, "name" | "phone" | "avatar">>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = "current_user";
const API_BASE =
  (import.meta.env.VITE_API_BASE as string) ||
  "https://fipaybank.onrender.com";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => null);
        return { ok: false, error: e?.error || "Sign in failed" };
      }

      const data = await res.json();

      if (!data.user) {
        return { ok: false, error: "Invalid server response" };
      }

      const u: User = {
        id: data.user._id || data.user.id,
        email: data.user.email,
        name: data.user.name,
        balance: data.user.balance ?? 0,
        suspended: data.user.suspended ?? false,
        phone: data.user.phone ?? "",
        avatar: data.user.avatar ?? "",
        countryCode: data.user.countryCode ?? "",
        countryName: data.user.countryName ?? "",
        countryFlag: data.user.countryFlag ?? "",
        dialCode: data.user.dialCode ?? "",
      };

      setUser(u);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
      return { ok: true };
    } catch (err) {
      console.error("signIn error:", err);
      return { ok: false, error: "Server unreachable" };
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
  ) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          countryCode,
          countryName,
          countryFlag,
          dialCode,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => null);
        return { ok: false, error: e?.error || "Sign up failed" };
      }

      const data = await res.json();

      if (!data.user) {
        return { ok: false, error: "Invalid server response" };
      }

      const u: User = {
        id: data.user._id || data.user.id,
        email: data.user.email,
        name: data.user.name,
        balance: data.user.balance ?? 0,
        suspended: data.user.suspended ?? false,
        phone: data.user.phone ?? "",
        avatar: data.user.avatar ?? "",
        countryCode: data.user.countryCode ?? "",
        countryName: data.user.countryName ?? "",
        countryFlag: data.user.countryFlag ?? "",
        dialCode: data.user.dialCode ?? "",
      };

      setUser(u);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
      return { ok: true };
    } catch (err) {
      console.error("signUp error:", err);
      return { ok: false, error: "Server unreachable" };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  // 🔥 Used by Home.tsx real-time checks
  const refreshBalance = async () => {
    if (!user) return;

    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const payload = data.user ?? data;

      const updatedUser: User = {
        ...user,
        balance: payload.balance ?? user.balance,
        suspended: payload.suspended ?? user.suspended ?? false,
      };

      setUser(updatedUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    } catch (err) {
      console.error("refreshBalance error:", err);
    }
  };

  const updateBalance = (newBalance: number) => {
    if (!user) return;
    const updatedUser = { ...user, balance: newBalance };
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  };

  const updateProfile = (
    updates: Partial<Pick<User, "name" | "phone" | "avatar">>
  ) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshBalance,
        updateBalance,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
