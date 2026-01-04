import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Home = () => {
  const { user, isLoading, refreshUserBalance } = useAuth();
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const isMounted = useRef(true);

  // Debug: Log user state changes
  useEffect(() => {
    console.log("🔍 [DEBUG] Current user state:", {
      id: user?.id,
      balance: user?.balance,
      hasUser: !!user,
      isLoading: isLoading,
      timestamp: new Date().toISOString()
    });

    setDebugInfo(prev => [...prev.slice(-9), `🕐 ${new Date().toLocaleTimeString()}: User - ${user ? `ID: ${user.id?.substring(0, 8)}..., Balance: $${user.balance}` : 'null'}, Loading: ${isLoading}`]);
  }, [user, isLoading]);

  useEffect(() => {
    isMounted.current = true;
    setDebugInfo(prev => [...prev, `🚀 Home mounted at ${new Date().toLocaleTimeString()}`]);
    
    return () => {
      isMounted.current = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setDebugInfo(prev => [...prev, `⏹️ Interval cleared at ${new Date().toLocaleTimeString()}`]);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id || isLoading) return;

    setDebugInfo(prev => [...prev, `🔄 Starting refresh for user: ${user.id.substring(0, 8)}...`]);

    // Initial refresh
    refreshUserBalance().then(() => {
      setDebugInfo(prev => [...prev, `✅ Initial refresh completed at ${new Date().toLocaleTimeString()}`]);
    }).catch(err => {
      setDebugInfo(prev => [...prev, `❌ Initial refresh failed: ${err.message}`]);
    });

    // Set up interval for balance updates
    const interval = setInterval(() => {
      if (isMounted.current && user?.id) {
        setDebugInfo(prev => [...prev.slice(-9), `🔄 Auto-refresh at ${new Date().toLocaleTimeString()}`]);
        refreshUserBalance().then(() => {
          setDebugInfo(prev => [...prev.slice(-9), `✅ Auto-refresh completed`]);
        }).catch(err => {
          setDebugInfo(prev => [...prev.slice(-9), `❌ Auto-refresh failed: ${err.message}`]);
        });
      }
    }, 15000); // Every 15 seconds

    setRefreshInterval(interval);
    setDebugInfo(prev => [...prev, `⏱️ Interval set: 15s`]);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [user?.id, isLoading, refreshUserBalance]);

  // Debug: Check localStorage
  useEffect(() => {
    const checkStorage = () => {
      const stored = localStorage.getItem('current_user');
      console.log("💾 [DEBUG] localStorage current_user:", stored ? JSON.parse(stored) : 'null');
      setDebugInfo(prev => [...prev.slice(-9), `💾 Storage: ${stored ? 'Has user data' : 'Empty'}`]);
    };
    
    checkStorage();
    const storageInterval = setInterval(checkStorage, 5000);
    
    return () => clearInterval(storageInterval);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("🔴 [DEBUG] No user detected, redirecting to signin");
    setDebugInfo(prev => [...prev, `🔴 Redirecting to signin at ${new Date().toLocaleTimeString()}`]);
    return <Navigate to="/signin" replace />;
  }

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

  // Manual refresh handler
  const handleManualRefresh = () => {
    setDebugInfo(prev => [...prev, `👆 Manual refresh triggered at ${new Date().toLocaleTimeString()}`]);
    refreshUserBalance().then(() => {
      setDebugInfo(prev => [...prev, `✅ Manual refresh completed`]);
    }).catch(err => {
      setDebugInfo(prev => [...prev, `❌ Manual refresh failed: ${err.message}`]);
    });
  };

  // Toggle debug panel
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Debug Panel */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-full"
        >
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </button>
        
        {showDebug && (
          <div className="bg-black/90 text-white p-4 rounded-lg max-w-xs max-h-64 overflow-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold">Debug Info</h3>
              <button 
                onClick={() => setDebugInfo([])}
                className="text-xs px-2 py-1 bg-red-600 rounded"
              >
                Clear
              </button>
            </div>
            <div className="text-xs space-y-1">
              <div className="border-b border-gray-700 pb-1">
                <strong>User ID:</strong> {user?.id?.substring(0, 16)}...
              </div>
              <div className="border-b border-gray-700 pb-1">
                <strong>Balance:</strong> ${user?.balance}
              </div>
              <div className="border-b border-gray-700 pb-1">
                <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
              </div>
              {debugInfo.map((log, index) => (
                <div key={index} className="border-b border-gray-700 pb-1 text-[10px]">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
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
        <Header onRefresh={handleManualRefresh} />
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
