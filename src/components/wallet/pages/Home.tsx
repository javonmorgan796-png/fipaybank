import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [hasNotificationBeenShown, setHasNotificationBeenShown] = useState(false);
  const previousBalance = useRef<number | null>(null);
  
  // Initialize refs
  useEffect(() => {
    if (user) {
      previousBalance.current = user.balance || 0;
    }
  }, [user]);

  // Simple refresh on mount
  useEffect(() => {
    if (user?.id) {
      console.log("🏠 Home mounted, refreshing balance...");
      refreshBalance();
      setLastRefresh(new Date());
    }
  }, [user?.id]);

  // Real-time balance checking (every 10 seconds)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      console.log("💰 Checking for balance updates...");
      checkBalanceUpdate();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user?.id]);

  // Check for balance updates
  const checkBalanceUpdate = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}/balance`);
      if (response.ok) {
        const data = await response.json();
        
        // Check if balance changed
        if (previousBalance.current !== null && 
            Math.abs(data.balance - previousBalance.current) > 0.01) {
          
          const difference = data.balance - previousBalance.current;
          console.log(`💰 Balance changed by $${difference.toFixed(2)}`);
          
          // Update UI
          await refreshBalance();
          
          // Show notification
          setBalanceUpdated(true);
          setBalanceUpdateMessage(
            difference > 0 
              ? `Balance increased by $${difference.toFixed(2)}!`
              : `Balance decreased by $${Math.abs(difference).toFixed(2)}`
          );
          
          setTimeout(() => {
            setBalanceUpdated(false);
          }, 5000);
          
          // Update ref
          previousBalance.current = data.balance;
        }
      }
    } catch (error) {
      console.error("Error checking balance:", error);
    }
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    console.log("🔄 Manual refresh triggered");
    await refreshBalance();
    setLastRefresh(new Date());
  };

  const handleContactAdmin = () => {
    if (!user) return;
    
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

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
    console.log("❌ No user, redirecting to signin");
    return <Navigate to="/signin" replace />;
  }

  const isSuspended = user.suspended || false;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Balance Update Notification */}
      {balanceUpdated && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="max-w-sm mx-4 p-4 rounded-xl bg-green-600 border border-green-700 text-center shadow-2xl">
            <p className="text-sm font-semibold text-white">
              💰 Balance Updated!
            </p>
            <p className="text-xs text-green-100 mt-1">
              {balanceUpdateMessage}
            </p>
            <div className="mt-2 text-xs text-green-200">
              Current Balance: <span className="font-bold">${user?.balance?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Debug info */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div>User: {user?.id?.substring(0, 8)}...</div>
        <div>Balance: ${user?.balance?.toFixed(2)}</div>
        <div>Status: {isSuspended ? '🚫 Suspended' : '✅ Active'}</div>
        {lastRefresh && (
          <div>Last refresh: {lastRefresh.toLocaleTimeString()}</div>
        )}
        <button 
          onClick={handleRefresh}
          className="mt-1 px-2 py-1 bg-blue-500 rounded text-xs"
        >
          Refresh Now
        </button>
      </div>

      {/* Suspended Popup - SIMPLIFIED */}
      {isSuspended && !hasNotificationBeenShown && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl bg-red-600 border border-red-700 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">🚫</span>
            </div>
            <p className="text-xl font-bold text-white mb-2">
              Account Suspended
            </p>
            <p className="text-sm text-red-100 mb-4">
              Your account has been suspended by the administrator.
              Please contact support for assistance.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  handleContactAdmin();
                  setHasNotificationBeenShown(true);
                }}
                className="w-full py-3 rounded-xl bg-white text-red-600 font-semibold hover:bg-red-50 transition duration-200"
              >
                Contact Admin Support
              </button>
              
              <button
                onClick={() => setHasNotificationBeenShown(true)}
                className="w-full py-2 text-sm text-red-200 hover:text-white transition"
              >
                Continue in Read-Only Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />
        <BalanceCard balance={user.balance} />
        <QuickActions disabled={isSuspended} />
        <SendMoney disabled={isSuspended} />
        <TransactionList limit={5} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
