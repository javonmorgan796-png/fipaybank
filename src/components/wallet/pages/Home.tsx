import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/NewAuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const BALANCE_UPDATE_THRESHOLD = 0.01;
const REAL_TIME_CHECK_INTERVAL = 5000; // Check every 5 seconds for suspension
const BALANCE_UPDATE_INTERVAL = 30000; // Check balance every 30 seconds

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [lastSuspensionCheck, setLastSuspensionCheck] = useState<Date | null>(null);
  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check user status in real-time
  const checkUserStatus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      console.log("🔍 Real-time status check for user:", user.id.substring(0, 8));
      
      // Call API to get latest user data
      const response = await fetch(`/api/users/${user.id}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const latestUserData = await response.json();
        setLastSuspensionCheck(new Date());
        
        // Check if suspension status changed
        if (previousSuspendedStatus.current !== null && 
            latestUserData.suspended !== previousSuspendedStatus.current) {
          
          console.log("🔄 Suspension status changed:", {
            from: previousSuspendedStatus.current,
            to: latestUserData.suspended
          });
          
          // Update local state if needed (this depends on your auth context)
          // If your auth context doesn't update automatically, refresh it
          refreshBalance();
        }
        
        // Check if balance changed
        if (previousBalance.current !== null && 
            Math.abs(latestUserData.balance - previousBalance.current) > BALANCE_UPDATE_THRESHOLD) {
          handleBalanceUpdate(latestUserData.balance);
        }
        
        // Update refs
        previousSuspendedStatus.current = latestUserData.suspended;
        previousBalance.current = latestUserData.balance;
      }
    } catch (error) {
      console.error("Error checking user status:", error);
    }
  }, [user?.id, refreshBalance]);

  // Handle balance update
  const handleBalanceUpdate = (newBalance: number) => {
    if (previousBalance.current === null) return;
    
    const balanceDifference = Math.abs(newBalance - previousBalance.current);
    
    setBalanceUpdated(true);
    setBalanceUpdateMessage(
      newBalance > previousBalance.current 
        ? `Your balance has increased by $${balanceDifference.toFixed(2)}!`
        : `Your balance has decreased by $${balanceDifference.toFixed(2)}.`
    );
    
    setTimeout(() => {
      setBalanceUpdated(false);
    }, 5000);
  };

  // Initialize and set up real-time polling
  useEffect(() => {
    if (user?.id) {
      console.log("🏠 Home mounted, setting up real-time monitoring...");
      refreshBalance();
      setLastRefresh(new Date());
      
      // Initialize previous values
      previousBalance.current = user.balance || 0;
      previousSuspendedStatus.current = user.suspended || false;
    }
  }, [user?.id]);

  // Set up real-time polling interval
  useEffect(() => {
    if (user?.id) {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      console.log("⏰ Setting up real-time polling...");
      
      // Initial check
      checkUserStatus();
      
      // Set up interval for real-time checks (more frequent for suspension)
      pollingIntervalRef.current = setInterval(() => {
        checkUserStatus();
      }, REAL_TIME_CHECK_INTERVAL);
      
      // Cleanup
      return () => {
        if (pollingIntervalRef.current) {
          console.log("🧹 Cleaning up polling interval");
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [user?.id, checkUserStatus]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered");
    refreshBalance();
    setLastRefresh(new Date());
    checkUserStatus();
  }, [refreshBalance, checkUserStatus]);

  // Auto-refresh balance (less frequent)
  useEffect(() => {
    if (user?.id && !user?.suspended) {
      const balanceIntervalId = setInterval(() => {
        console.log("💰 Auto-refreshing balance...");
        refreshBalance();
      }, BALANCE_UPDATE_INTERVAL);

      return () => clearInterval(balanceIntervalId);
    }
  }, [user?.id, user?.suspended, refreshBalance]);

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleRefreshFromPopup = () => {
    handleRefresh();
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

  return (
    <div className="min-h-screen bg-background relative">
      {/* Real-time status indicator */}
      <div className="fixed top-4 right-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${user.suspended ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span>Real-time: {user.suspended ? 'Suspended' : 'Active'}</span>
        </div>
        {lastSuspensionCheck && (
          <div className="text-xs text-gray-300 mt-1">
            Last check: {lastSuspensionCheck.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Simple debug info */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div>User: {user?.id?.substring(0, 8)}...</div>
        <div>Balance: ${user?.balance?.toFixed(2)}</div>
        <div>Status: {user?.suspended ? '🚫 Suspended' : '✅ Active'}</div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${user.suspended ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span>Live monitoring</span>
        </div>
        {lastRefresh && (
          <div>Last refresh: {lastRefresh.toLocaleTimeString()}</div>
        )}
        <button 
          onClick={handleRefresh}
          className="mt-1 px-2 py-1 bg-blue-500 rounded text-xs hover:bg-blue-600 transition"
        >
          Refresh Now
        </button>
      </div>

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

      {/* Suspended Popup */}
      {user.suspended && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 border border-red-700 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
              <span className="text-2xl">🚫</span>
            </div>
            <p className="text-xl font-bold text-white mb-2">
              Account Suspended
            </p>
            <p className="text-sm text-red-100 mb-4">
              ⚠️ Your account has been suspended by the administrator.
              All wallet functions are disabled until further notice.
            </p>
            
            <div className="mb-6 p-3 rounded-lg bg-red-500/20">
              <p className="text-xs text-red-200">
                <span className="font-semibold">User ID:</span> {user?.id?.substring(0, 12)}...
              </p>
              <p className="text-xs text-red-200 mt-1">
                <span className="font-semibold">Current Balance:</span> ${user?.balance?.toFixed(2)}
              </p>
              <p className="text-xs text-red-200 mt-1">
                <span className="font-semibold">Last Updated:</span> {lastSuspensionCheck?.toLocaleTimeString() || 'Checking...'}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleContactAdmin}
                className="w-full py-3 rounded-xl bg-white text-red-600 font-semibold hover:bg-red-50 transition duration-200"
              >
                📧 Contact Admin Support
              </button>
              
              <button
                onClick={handleRefreshFromPopup}
                className="w-full py-3 rounded-xl bg-red-500/30 text-white font-semibold hover:bg-red-500/40 transition duration-200 border border-red-500/50"
              >
                🔄 Refresh Account Status
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-red-500/30">
              <p className="text-xs text-red-200">
                Real-time monitoring is active. This popup will automatically update.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />
        <BalanceCard balance={user.balance} />
        <QuickActions disabled={user.suspended} />
        <SendMoney disabled={user.suspended} />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
