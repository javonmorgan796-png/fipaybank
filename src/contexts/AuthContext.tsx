import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";

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
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
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
  refreshUserBalance: () => Promise<boolean>;
  isRefreshing: boolean;
}

/* =======================
   CONSTANTS
======================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CURRENT_USER_KEY = "fipay_current_user";

// Ensure no trailing slash in API_BASE
const getApiBase = () => {
  const base = (import.meta.env.VITE_API_BASE as string) || "https://fipaybank.onrender.com";
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const API_BASE = getApiBase();

/* =======================
   PROVIDER
======================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /* =======================
     LOAD USER FROM STORAGE (SAFE)
  ======================= */
  useEffect(() => {
    console.log("🔍 [Auth] Loading user from storage...");
    
    try {
      const savedUser = localStorage.getItem(CURRENT_USER_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        
        // Validate required fields
        if (parsed && parsed.id && parsed.email && parsed.name !== undefined) {
          console.log("✅ [Auth] Valid user found in storage:", parsed.id.substring(0, 8));
          setUser(parsed);
        } else {
          console.warn("⚠️ [Auth] Invalid user data in storage, clearing");
          localStorage.removeItem(CURRENT_USER_KEY);
        }
      } else {
        console.log("ℹ️ [Auth] No user found in storage");
      }
    } catch (error) {
      console.error("❌ [Auth] Error loading user from storage:", error);
      localStorage.removeItem(CURRENT_USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* =======================
     SAFE UPDATE USER FUNCTION
  ======================= */
  const updateUser = useCallback((updates: Partial<User>) => {
    console.log("🔄 [Auth] updateUser called with:", updates);
    
    setUser((prev) => {
      if (!prev) {
        console.warn("⚠️ [Auth] Cannot update - no previous user");
        return prev;
      }
      
      // Log previous state
      console.log("📝 [Auth] Previous user state:", {
        id: prev.id.substring(0, 8),
        balance: prev.balance,
        name: prev.name,
        email: prev.email
      });
      
      // Filter out undefined values and create safe updates
      const safeUpdates: Partial<User> = {};
      
      // Only update fields that are explicitly provided and not undefined
      if (updates.balance !== undefined) {
        safeUpdates.balance = updates.balance;
      }
      if (updates.suspended !== undefined) {
        safeUpdates.suspended = updates.suspended;
      }
      if (updates.name !== undefined && updates.name !== "") {
        safeUpdates.name = updates.name;
      }
      if (updates.email !== undefined && updates.email !== "") {
        safeUpdates.email = updates.email;
      }
      if (updates.phone !== undefined) {
        safeUpdates.phone = updates.phone;
      }
      if (updates.avatar !== undefined) {
        safeUpdates.avatar = updates.avatar;
      }
      if (updates.countryCode !== undefined) {
        safeUpdates.countryCode = updates.countryCode;
      }
      if (updates.countryName !== undefined) {
        safeUpdates.countryName = updates.countryName;
      }
      if (updates.countryFlag !== undefined) {
        safeUpdates.countryFlag = updates.countryFlag;
      }
      if (updates.dialCode !== undefined) {
        safeUpdates.dialCode = updates.dialCode;
      }
      
      // Merge with previous state
      const updated = { ...prev, ...safeUpdates };
      
      console.log("✅ [Auth] New user state:", {
        id: updated.id.substring(0, 8),
        balance: updated.balance,
        name: updated.name,
        email: updated.email
      });
      
      // Save to localStorage
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        console.log("💾 [Auth] Saved to localStorage");
      } catch (error) {
        console.error("❌ [Auth] Failed to save to localStorage:", error);
      }
      
      return updated;
    });
  }, []);

  /* =======================
     SAFE BALANCE REFRESH FUNCTION
  ======================= */
  const refreshUserBalance = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      console.log("⏭️ [Auth] No user ID, skipping refresh");
      return false;
    }
    
    // Prevent concurrent refreshes
    if (isRefreshing) {
      console.log("⏭️ [Auth] Refresh already in progress");
      return false;
    }
    
    setIsRefreshing(true);
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      console.log("🔄 [Auth] Starting balance refresh for user:", user.id.substring(0, 8));
      
      // Try multiple endpoints - starting with the most likely
      const endpoints = [
        `${API_BASE}/api/users/${user.id}/balance`,
        `${API_BASE}/api/auth/me`,
        `${API_BASE}/api/users/${user.id}`
      ];
      
      let response: Response | null = null;
      let lastError: Error | null = null;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`📡 [Auth] Trying endpoint: ${endpoint}`);
          
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'include',
            signal: abortController.signal,
          });
          
          console.log(`📡 [Auth] Response status: ${response.status}`);
          
          if (response.ok) {
            break; // Success, stop trying other endpoints
          }
          
          if (response.status === 404) {
            console.log(`❌ [Auth] Endpoint not found: ${endpoint}`);
            continue; // Try next endpoint
          }
          
        } catch (error) {
          lastError = error as Error;
          console.log(`⚠️ [Auth] Failed to fetch ${endpoint}:`, error);
          continue;
        }
      }
      
      if (!response || !response.ok) {
        console.warn("⚠️ [Auth] All balance endpoints failed");
        return false;
      }
      
      const data = await response.json().catch(() => ({}));
      console.log("✅ [Auth] Refresh response data:", data);
      
      // Extract user data from different response formats
      const userData = data.user || data;
      
      if (!userData) {
        console.warn("⚠️ [Auth] No user data in response");
        return false;
      }
      
      // Prepare updates
      const updates: Partial<User> = {};
      
      if (userData.balance !== undefined && userData.balance !== null) {
        updates.balance = Number(userData.balance);
      }
      
      if (userData.suspended !== undefined && userData.suspended !== null) {
        updates.suspended = Boolean(userData.suspended);
      }
      
      // Apply updates if we have any
      if (Object.keys(updates).length > 0) {
        console.log("📊 [Auth] Applying updates:", updates);
        updateUser(updates);
      } else {
        console.log("ℹ️ [Auth] No balance/suspended updates to apply");
      }
      
      return true;
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("⏹️ [Auth] Refresh request aborted");
      } else {
        console.error("❌ [Auth] Error refreshing balance:", error);
      }
      return false;
    } finally {
      setIsRefreshing(false);
      abortControllerRef.current = null;
    }
  }, [user?.id, updateUser, isRefreshing]);

  /* =======================
     SIGN IN
  ======================= */
  const signIn = async (email: string, password: string) => {
    console.log("🔐 [Auth] Signing in with email:", email);
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      console.log(`📡 [Auth] Login response status: ${res.status}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ [Auth] Login failed:", errorText);
        
        try {
          const err = JSON.parse(errorText);
          return { ok: false, error: err.error || "Sign in failed" };
        } catch {
          return { ok: false, error: `Login failed (${res.status})` };
        }
      }

      const data = await res.json();
      console.log("✅ [Auth] Login successful, user data:", data.user?.id);

      if (!data.user) {
        console.error("❌ [Auth] No user data in response");
        return { ok: false, error: "Invalid response from server" };
      }

      const u: User = {
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

      console.log("👤 [Auth] Setting user:", u.id.substring(0, 8));
      setUser(u);
      
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
        console.log("💾 [Auth] User saved to localStorage");
      } catch (storageError) {
        console.error("❌ [Auth] Failed to save user to localStorage:", storageError);
      }

      return { ok: true };
    } catch (err) {
      console.error("❌ [Auth] Sign in error:", err);
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
    console.log("📝 [Auth] Signing up:", email);
    
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

      console.log(`📡 [Auth] Signup response status: ${res.status}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ [Auth] Signup failed:", errorText);
        
        try {
          const err = JSON.parse(errorText);
          return { ok: false, error: err.error || "Sign up failed" };
        } catch {
          return { ok: false, error: `Signup failed (${res.status})` };
        }
      }

      const data = await res.json();
      console.log("✅ [Auth] Signup successful");

      const u: User = {
        id: data.user._id || data.user.id,
        email: data.user.email || email,
        name: data.user.name || name,
        balance: data.user.balance ?? 0,
        suspended: data.user.suspended ?? false,
        phone: data.user.phone || phone || "",
        avatar: data.user.avatar || "",
        countryCode: data.user.countryCode || countryCode || "",
        countryName: data.user.countryName || countryName || "",
        countryFlag: data.user.countryFlag || countryFlag || "",
        dialCode: data.user.dialCode || dialCode || "",
      };

      console.log("👤 [Auth] Setting new user:", u.id.substring(0, 8));
      setUser(u);
      
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
        console.log("💾 [Auth] New user saved to localStorage");
      } catch (storageError) {
        console.error("❌ [Auth] Failed to save user to localStorage:", storageError);
      }

      return { ok: true };
    } catch (err) {
      console.error("❌ [Auth] Sign up error:", err);
      return { ok: false, error: "Server unreachable" };
    }
  };

  /* =======================
     SIGN OUT
  ======================= */
  const signOut = useCallback(() => {
    console.log("👋 [Auth] Signing out user:", user?.id?.substring(0, 8));
    
    // Cancel any pending refresh
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setUser(null);
    
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
      console.log("🧹 [Auth] User removed from localStorage");
    } catch (error) {
      console.error("❌ [Auth] Failed to remove user from localStorage:", error);
    }
  }, [user?.id]);

  /* =======================
     UPDATE BALANCE
  ======================= */
  const updateBalance = useCallback((newBalance: number) => {
    console.log("💰 [Auth] Updating balance to:", newBalance);
    updateUser({ balance: newBalance });
  }, [updateUser]);

  /* =======================
     UPDATE PROFILE
  ======================= */
  const updateProfile = useCallback((
    updates: Partial<Pick<User, "name" | "phone" | "avatar">>
  ) => {
    console.log("👤 [Auth] Updating profile:", updates);
    updateUser(updates);
  }, [updateUser]);

  /* =======================
     PROVIDER VALUE
  ======================= */
  const contextValue: AuthContextType = {
    user,
    isLoading,
    isRefreshing,
    signIn,
    signUp,
    signOut,
    updateBalance,
    updateProfile,
    updateUser,
    refreshUserBalance,
  };

  console.log("🔄 [Auth] Context updated:", {
    hasUser: !!user,
    userId: user?.id?.substring(0, 8),
    isLoading,
    isRefreshing
  });

  return (
    <AuthContext.Provider value={contextValue}>
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
