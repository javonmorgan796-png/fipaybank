import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Home = () => {
  const { user, isLoading, updateUser } = useAuth();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    addLog(`Home mounted. User: ${user ? `ID: ${user.id}, Balance: ${user.balance}` : 'null'}`);
    addLog(`isLoading: ${isLoading}`);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      addLog("No user ID available, skipping fetch");
      return;
    }

    addLog(`Starting user fetch for ID: ${user.id}`);
    
    const API_BASE =
      (import.meta.env.VITE_API_BASE as string) || "https://fipaybank.onrender.com/";

    let timer: number;

    const fetchUser = async () => {
      try {
        addLog(`Fetching user data from: ${API_BASE}/api/users/${user.id}`);
        
        // Try with credentials/cookies
        const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
          credentials: 'include', // This preserves cookies/sessions
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        addLog(`Response status: ${res.status}`);
        
        if (!res.ok) {
          addLog(`Fetch failed with status: ${res.status}`);
          return;
        }

        const data = await res.json();
        addLog(`Received data: ${JSON.stringify(data)}`);
        
        const fresh = data.user;
        if (!fresh) {
          addLog("No user data in response");
          return;
        }

        addLog(`Updating user: Balance ${user.balance} -> ${fresh.balance}, Suspended ${user.suspended} -> ${fresh.suspended}`);
        
        // Update ONLY specific fields
        updateUser({
          balance: fresh.balance,
          suspended: fresh.suspended,
          // Explicitly preserve critical fields
          id: user.id,
          email: user.email,
          token: user.token,
          name: user.name,
        });
        
        addLog("Update successful");
        
      } catch (err) {
        addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error("User refresh error", err);
      }
    };

    // Initial fetch after a delay
    const initialTimer = setTimeout(fetchUser, 1000);
    
    // Set interval - increased to reduce issues
    timer = window.setInterval(fetchUser, 30000); // 30 seconds

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
      addLog("Cleanup - timers cleared");
    };
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    addLog("No user detected, redirecting to signin");
    return <Navigate to="/signin" replace />;
  }

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Debug Panel (remove in production) */}
      <div className="fixed bottom-4 right-4 z-50">
        <details className="bg-black/90 text-white p-4 rounded-lg max-w-xs max-h-64 overflow-auto">
          <summary className="cursor-pointer font-bold">Debug Logs</summary>
          <div className="mt-2 text-xs space-y-1">
            {debugLogs.map((log, index) => (
              <div key={index} className="border-b border-gray-700 pb-1">
                {log}
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* 🚫 ACCOUNT SUSPENDED OVERLAY */}
      {user.suspended && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl bg-red-600 border border-red-700 text-center shadow-2xl animate-fade-in">
            <p className="text-lg font-bold text-white mb-2">
              🚫 Account Suspended
            </p>
            <p className="text-sm text-red-100 mb-4">
              Your account has been suspended by the administrator.
              Please contact support for assistance.
            </p>
            <button
              onClick={handleContactAdmin}
              className="w-full py-2 rounded-xl bg-white text-red-600 font-semibold hover:bg-red-100 transition"
            >
              Contact Admin
            </button>
          </div>
        </div>
      )}

      {/* 🏦 WALLET */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <Header />
        <BalanceCard balance={user.balance} />
        <QuickActions />
        <SendMoney />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
