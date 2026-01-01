import { createContext, useContext, useState, useEffect, ReactNode } from "react";

/* =======================
   TYPES
======================= */

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

  updateBalance: (newBalance: number) => void;
  updateProfile: (updates: Partial<Pick<User, "name" | "phone" | "avatar">>) => void;

  updateUser: (updates: Partial<User>) => void; // ✅ IMPORTANT
}

/* =======================
   CONSTANTS
======================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CURRENT_USER_KEY = "current_user";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || "https://fipaybank.onrender.com";

/* =======================
   PROVIDER
======================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* =======================
     LOAD USER FROM STORAGE
  ======================= */
  useEffect(() => {
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  /* =======================
     SIGN IN
  ======================= */
  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || "Sign in failed" };
      }

      const data = await res.json();

      if (!data.user) {
        return { ok: false, error: "Invalid response" };
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
      console.error("signIn error", err);
      return { ok: false, error: "Server unreachable" };
    }
  };

  /* =======================
     SIGN UP
  ======================= */
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
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || "Sign up failed" };
      }

      const data = await res.json();

      const u: User = {
        id: data.user._id || data.user.id,
        email: data.user.email,
        name: data.user.name,
        balance: data.user.balance ?? 0,
        suspended: data.user.suspended ?? false,
      };

      setUser(u);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));

      return { ok: true };
    } catch (err) {
      console.error("signUp error", err);
      return { ok: false, error: "Server unreachable" };
    }
  };

  /* =======================
     SIGN OUT
  ======================= */
  const signOut = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  /* =======================
     UPDATE BALANCE
  ======================= */
  const updateBalance = (newBalance: number) => {
    updateUser({ balance: newBalance });
  };

  /* =======================
     UPDATE PROFILE
  ======================= */
  const updateProfile = (
    updates: Partial<Pick<User, "name" | "phone" | "avatar">>
  ) => {
    updateUser(updates);
  };

  /* =======================
     🔥 UNIVERSAL USER UPDATER
  ======================= */
  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  /* =======================
     PROVIDER
  ======================= */
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateBalance,
        updateProfile,
        updateUser, // ✅ CRITICAL
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* =======================
   HOOK
======================= */

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
