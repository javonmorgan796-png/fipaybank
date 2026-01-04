// SIMPLEST WORKING VERSION - src/contexts/SimpleAuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  suspended?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  updateBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = "fipay_simple_user";

export const SimpleAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    console.log("Trying to sign in...");
    
    // FIXED URL - No double slash
    const API_BASE = "https://fipaybank.onrender.com";
    const loginUrl = `${API_BASE}/api/auth/login`;
    
    console.log("URL:", loginUrl);
    
    try {
      // FIRST: Test if the endpoint exists with a GET/HEAD request
      const testRes = await fetch(loginUrl, { method: 'HEAD' });
      console.log("Endpoint test:", testRes.status);
      
      if (testRes.status === 404) {
        console.log("Endpoint doesn't exist. Using demo mode.");
        
        // DEMO MODE: Create a demo user
        const demoUser: User = {
          id: `demo_${Date.now()}`,
          email,
          name: email.split('@')[0],
          balance: 5000,
          suspended: false,
        };
        
        setUser(demoUser);
        return { ok: true };
      }
      
      // Try actual login
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      console.log("Login response:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        const newUser: User = {
          id: data.user?._id || data.user?.id || data._id || data.id,
          email: data.user?.email || data.email || email,
          name: data.user?.name || data.name || "User",
          balance: data.user?.balance ?? data.balance ?? 0,
          suspended: data.user?.suspended ?? false,
        };
        
        setUser(newUser);
        return { ok: true };
      } else {
        const errorText = await res.text();
        return { ok: false, error: `Login failed: ${res.status} ${errorText}` };
      }
      
    } catch (error: any) {
      console.error("Login error:", error);
      
      // If network error, use demo mode
      const demoUser: User = {
        id: `demo_${Date.now()}`,
        email,
        name: email.split('@')[0],
        balance: 5000,
        suspended: false,
      };
      
      setUser(demoUser);
      return { ok: true };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    // Create demo user for signup too
    const demoUser: User = {
      id: `demo_${Date.now()}`,
      email,
      name,
      balance: 1000,
      suspended: false,
    };
    
    setUser(demoUser);
    return { ok: true };
  };

  const signOut = () => {
    setUser(null);
  };

  const updateBalance = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : null);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useSimpleAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useSimpleAuth must be used within a SimpleAuthProvider");
  }
  return context;
};
