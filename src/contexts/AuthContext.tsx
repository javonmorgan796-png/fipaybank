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

  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>; // NEW: Safe refresh method
}

/* =======================
   CONSTANTS
======================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CURRENT_USER_KEY = "current_user";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || "https://fipaybank.onrender.com/";

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
      try {
        const parsed = JSON.parse(savedUser);
        // Validate that required fields exist
        if (parsed.id && parsed.email && parsed.name !== undefined) {
          setUser(parsed);
        } else {
          localStorage.removeItem(CURRENT_USER_KEY);
        }
      } catch {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  /* =======================
     🔄 SAFE USER REFRESHER
  ======================= */
  const refreshUser = async () => {
    if (!user?.id) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        console.warn("User refresh failed:", res.status);
        return;
      }

      const data = await res.json();
      const fresh = data.user;
      
      if (!fresh) {
        console.warn("No user data in refresh response");
        return;
      }

      // SAFE UPDATE: Only update specific fields we expect from the API
      setUser((prev) => {
        if (!prev) return prev;
        
        const updated = {
          ...prev, // Keep all existing data
          balance: fresh.balance ?? prev.balance,
          suspended: fresh.suspended ?? prev.suspended,
          // Only update name/email if they exist (they should)
          ...(fresh.name && { name: fresh.name }),
          ...(fresh.email && { email: fresh.email }),
        };
        
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        return updated;
      });
      
    } catch (err) {
      console.error("refreshUser error:", err);
    }
  };

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
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, balance: newBalance };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  /* =======================
     UPDATE PROFILE
  ======================= */
  const updateProfile = (
    updates: Partial<Pick<User, "name" | "phone" | "avatar">>
  ) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  /* =======================
     🔥 UNIVERSAL USER UPDATER (IMPROVED)
  ======================= */
  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      
      // Filter out undefined values to prevent overwriting existing data
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const updated = { ...prev, ...filteredUpdates };
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
        updateUser,
        refreshUser, // NEW: Add safe refresh method
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
