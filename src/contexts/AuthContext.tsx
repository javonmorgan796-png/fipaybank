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
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  updateBalance: (newBalance: number) => void;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = "fipay_user_v2";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "https://fipaybank.onrender.com";

// Remove trailing slash if present
const cleanApiBase = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on initial load
  useEffect(() => {
    const loadUser = () => {
      try {
        const saved = localStorage.getItem(USER_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Basic validation
          if (parsed && parsed.id && parsed.email && parsed.name) {
            setUser(parsed);
            console.log("✅ Loaded user from storage:", parsed.id.substring(0, 8));
          } else {
            localStorage.removeItem(USER_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("Failed to load user:", error);
        localStorage.removeItem(USER_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } catch (error) {
        console.error("Failed to save user:", error);
      }
    }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${cleanApiBase}/api/auth/login`, {
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
        return { ok: false, error: "Invalid response from server" };
      }

      const newUser: User = {
        id: data.user._id || data.user.id,
        email: data.user.email || email,
        name: data.user.name || "User",
        balance: data.user.balance ?? 0,
        suspended: data.user.suspended ?? false,
        phone: data.user.phone || "",
        avatar: data.user.avatar || "",
        countryCode: data.user.countryCode || "",
        countryName: data.user.countryName || "",
        countryFlag: data.user.countryFlag || "",
        dialCode: data.user.dialCode || "",
      };

      setUser(newUser);
      return { ok: true };
    } catch (err) {
      console.error("Sign in error:", err);
      return { ok: false, error: "Server unreachable" };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const res = await fetch(`${cleanApiBase}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || "Sign up failed" };
      }

      const data = await res.json();

      const newUser: User = {
        id: data.user._id || data.user.id,
        email: data.user.email || email,
        name: data.user.name || name,
        balance: data.user.balance ?? 0,
        suspended: data.user.suspended ?? false,
      };

      setUser(newUser);
      return { ok: true };
    } catch (err) {
      console.error("Sign up error:", err);
      return { ok: false, error: "Server unreachable" };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const updateBalance = (newBalance: number) => {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  // SIMPLE refresh function - ONLY gets balance, doesn't touch user object
  const refreshBalance = async () => {
    if (!user?.id) return;

    try {
      console.log("🔄 Refreshing balance for user:", user.id.substring(0, 8));

      // Try multiple endpoints
      const endpoints = [
        `${cleanApiBase}/api/users/${user.id}/balance`,
        `${cleanApiBase}/api/auth/balance`,
        `${cleanApiBase}/api/users/${user.id}`,
      ];

      let balanceData: any = null;

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            headers: { "Content-Type": "application/json" },
          });

          if (res.ok) {
            const data = await res.json();
            console.log("✅ Balance response from", endpoint, data);
            
            // Extract balance from different response formats
            if (data.balance !== undefined) {
              balanceData = { balance: data.balance, suspended: data.suspended || false };
              break;
            } else if (data.user?.balance !== undefined) {
              balanceData = { 
                balance: data.user.balance, 
                suspended: data.user.suspended || false 
              };
              break;
            }
          }
        } catch (err) {
          console.log("Failed endpoint:", endpoint, err);
          continue;
        }
      }

      if (balanceData && user) {
        // ONLY update balance and suspended status
        const updates: Partial<User> = {};
        
        if (balanceData.balance !== undefined) {
          updates.balance = Number(balanceData.balance);
        }
        
        if (balanceData.suspended !== undefined) {
          updates.suspended = Boolean(balanceData.suspended);
        }
        
        // Only update if we have changes
        if (Object.keys(updates).length > 0) {
          setUser(prev => prev ? { ...prev, ...updates } : null);
          console.log("✅ Balance updated to:", updates.balance);
        }
      } else {
        console.log("⚠️ No balance data received");
      }
    } catch (error) {
      console.error("❌ Error refreshing balance:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateBalance,
        refreshBalance,
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
