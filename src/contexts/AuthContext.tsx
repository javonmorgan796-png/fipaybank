// src/contexts/AuthContext.tsx
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
  testEndpoints: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = "fipay_user_v3";

// Get API base URL
const getApiBase = () => {
  const envApi = import.meta.env.VITE_API_BASE;
  const base = envApi || "https://fipaybank.onrender.com";
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const API_BASE = getApiBase();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.email) {
          setUser(parsed);
        }
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save user when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  // Function to test all possible endpoints
  const testEndpoints = async () => {
    console.log("🔍 Testing API endpoints...");
    
    const endpoints = [
      // Common auth endpoints
      { path: '/api/auth/login', method: 'POST', type: 'login' },
      { path: '/api/auth/signin', method: 'POST', type: 'login' },
      { path: '/api/auth/register', method: 'POST', type: 'signup' },
      { path: '/api/auth/signup', method: 'POST', type: 'signup' },
      { path: '/api/login', method: 'POST', type: 'login' },
      { path: '/api/register', method: 'POST', type: 'signup' },
      { path: '/api/user/login', method: 'POST', type: 'login' },
      { path: '/api/user/register', method: 'POST', type: 'signup' },
      { path: '/auth/login', method: 'POST', type: 'login' },
      { path: '/auth/register', method: 'POST', type: 'signup' },
      { path: '/users/login', method: 'POST', type: 'login' },
      { path: '/users/register', method: 'POST', type: 'signup' },
      
      // GET endpoints for testing
      { path: '/api/endpoints', method: 'GET', type: 'info' },
      { path: '/api', method: 'GET', type: 'info' },
      { path: '/', method: 'GET', type: 'info' },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const url = `${API_BASE}${endpoint.path}`;
        console.log(`Testing: ${endpoint.method} ${url}`);
        
        const res = await fetch(url, {
          method: endpoint.method === 'POST' ? 'HEAD' : 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: res.status,
          statusText: res.statusText,
          type: endpoint.type,
        });
        
        console.log(`  Status: ${res.status} ${res.statusText}`);
        
        if (endpoint.method === 'GET' && res.ok) {
          try {
            const data = await res.text();
            console.log(`  Response: ${data.substring(0, 200)}...`);
          } catch {
            // Ignore
          }
        }
      } catch (error: any) {
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'ERROR',
          statusText: error.message,
          type: endpoint.type,
        });
        console.log(`  Error: ${error.message}`);
      }
    }
    
    console.log("📋 Endpoint test results:", results);
    return results;
  };

  const signIn = async (email: string, password: string) => {
    console.log("🔐 Attempting sign in...");
    
    // Try different login endpoints
    const loginEndpoints = [
      '/api/auth/signin',
      '/api/auth/login', 
      '/api/login',
      '/api/user/login',
      '/auth/login',
      '/users/login',
    ];
    
    for (const endpoint of loginEndpoints) {
      try {
        const url = `${API_BASE}${endpoint}`;
        console.log(`🔄 Trying: ${url}`);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });
        
        console.log(`  Status: ${res.status}`);
        
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Login successful with endpoint:", endpoint);
          console.log("📦 Response data:", data);
          
          // Create user from response (adapt based on actual response format)
          const newUser: User = {
            id: data.user?._id || data.user?.id || data._id || data.id || `user_${Date.now()}`,
            email: data.user?.email || data.email || email,
            name: data.user?.name || data.name || email.split('@')[0],
            balance: data.user?.balance ?? data.balance ?? 1000,
            suspended: data.user?.suspended ?? data.suspended ?? false,
          };
          
          setUser(newUser);
          return { ok: true };
        } else if (res.status !== 404) {
          // Not a 404, but some other error
          const errorText = await res.text();
          return { ok: false, error: `Login failed (${res.status}): ${errorText.substring(0, 100)}` };
        }
        // If 404, try next endpoint
      } catch (error) {
        console.log(`  Error: ${error}`);
        // Continue to next endpoint
      }
    }
    
    // If all endpoints failed, check if we can access the API at all
    try {
      const testRes = await fetch(API_BASE, { method: 'GET' });
      if (!testRes.ok) {
        return { ok: false, error: `Cannot connect to server at ${API_BASE}` };
      }
    } catch {
      return { ok: false, error: `Server unreachable: ${API_BASE}` };
    }
    
    // All endpoints returned 404
    return { 
      ok: false, 
      error: `No login endpoint found. Checked: ${loginEndpoints.join(', ')}` 
    };
  };

  const signUp = async (email: string, password: string, name: string) => {
    console.log("📝 Attempting sign up...");
    
    // Try different signup endpoints
    const signupEndpoints = [
      '/api/auth/register',
      '/api/auth/signup',
      '/api/register',
      '/api/user/register',
      '/auth/register',
      '/users/register',
    ];
    
    for (const endpoint of signupEndpoints) {
      try {
        const url = `${API_BASE}${endpoint}`;
        console.log(`🔄 Trying: ${url}`);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
        });
        
        console.log(`  Status: ${res.status}`);
        
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Signup successful with endpoint:", endpoint);
          
          const newUser: User = {
            id: data.user?._id || data.user?.id || data._id || data.id || `user_${Date.now()}`,
            email: data.user?.email || data.email || email,
            name: data.user?.name || data.name || name,
            balance: data.user?.balance ?? data.balance ?? 1000,
            suspended: data.user?.suspended ?? data.suspended ?? false,
          };
          
          setUser(newUser);
          return { ok: true };
        } else if (res.status !== 404) {
          const errorText = await res.text();
          return { ok: false, error: `Signup failed (${res.status}): ${errorText.substring(0, 100)}` };
        }
      } catch (error) {
        console.log(`  Error: ${error}`);
        // Continue to next endpoint
      }
    }
    
    return { 
      ok: false, 
      error: `No signup endpoint found. Checked: ${signupEndpoints.join(', ')}` 
    };
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
        testEndpoints,
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
