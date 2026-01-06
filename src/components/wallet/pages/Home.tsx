import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/NewAuthContext"; // Use the new context
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const BALANCE_UPDATE_THRESHOLD = 0.01; // Minimum change to consider as an update

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);

  // Display suspended popup when user is suspended
  const displaySuspendedPopup = () => {
    if (user?.suspended) {
      setShowSuspendedPopup(true);
    }
  };

  // Check if user's balance has been updated
  const checkBalanceUpdate = () => {
    if (!user || previousBalance.current === null) {
      // First time check, store current balance
      previousBalance.current = user?.balance || 0;
      return false;
    }

    const currentBalance = user.balance || 0;
    const balanceDifference = Math.abs(currentBalance - previousBalance.current);
    
    if (balanceDifference > BALANCE_UPDATE_THRESHOLD) {
      setBalanceUpdated(true);
      setBalanceUpdateMessage(
        currentBalance > previousBalance.current 
          ? `Your balance has increased by $${balanceDifference.toFixed(2)}!`
          : `Your balance has decreased by $${balanceDifference.toFixed(2)}.`
      );
      
      // Update the previous balance for next check
      previousBalance.current = currentBalance;
      
      // Auto-hide the message after 5 seconds
      setTimeout(() => {
        setBalanceUpdated(false);
      }, 5000);
      
      return true;
    }
    
    return false;
  };

  // Simple refresh on mount
  useEffect(() => {
    if (user?.id) {
      console.log("🏠 Home mounted, refreshing balance...");
      refreshBalance();
      setLastRefresh(new Date());
      
      // Initialize previous values
      previousBalance.current = user.balance || 0;
      previousSuspendedStatus.current = user.suspended || false;
    }
  }, [user?.id]);

  // Check for suspended status changes
  useEffect(() => {
    if (user && previousSuspendedStatus.current !== null) {
      // If user just got suspended
      if (user.suspended && !previousSuspendedStatus.current) {
        displaySuspendedPopup();
      }
      
      // Update previous suspended status
      previousSuspendedStatus.current = user.suspended;
    } else if (user) {
      // First time setting
      previousSuspendedStatus.current = user.suspended || false;
      
      // Display popup if already suspended
      if (user.suspended) {
        displaySuspendedPopup();
      }
    }
  }, [user?.suspended]);

  // Manual refresh handler with balance update check
  const handleRefresh = () => {
    const oldBalance = user?.balance || 0;
    refreshBalance();
    setLastRefresh(new Date());
    
    // Check for balance update after a short delay to allow state update
    setTimeout(() => {
      checkBalanceUpdate();
    }, 500);
  };

  // Auto-refresh balance every 30 seconds
  useEffect(() => {
    if (user?.id && !user?.suspended) {
      const intervalId = setInterval(() => {
        console.log("🔄 Auto-refreshing balance...");
        handleRefresh();
      }, 30000); // 30 seconds

      return () => clearInterval(intervalId);
    }
  }, [user?.id, user?.suspended]);

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

  const closeSuspendedPopup = () => {
    setShowSuspendedPopup(false);
  };

  const handleRefreshFromPopup = () => {
    closeSuspendedPopup();
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
      {/* Simple debug info */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div>User: {user?.id?.substring(0, 8)}...</div>
        <div>Balance: ${user?.balance?.toFixed(2)}</div>
        <div>Status: {user?.suspended ? "Suspended" : "Active"}</div>
        {lastRefresh && (
          <div>Last refresh: {lastRefresh.toLocaleTimeString()}</div>
        )}
        <button 
          onClick={handleRefresh}
          className="mt-1 px-2 py-1 bg-blue-500 rounded text-xs"
        >
          Refresh Balance
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
      {(showSuspendedPopup || user.suspended) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 border border-red-700 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">🚫</span>
            </div>
            <p className="text-xl font-bold text-white mb-2">
              Account Suspended
            </p>
            <p className="text-sm text-red-100 mb-4">
              Your account has been temporarily suspended by the administrator.
              All wallet functions are currently unavailable.
            </p>
            
            <div className="mb-6 p-3 rounded-lg bg-red-500/20">
              <p className="text-xs text-red-200">
                <span className="font-semibold">User ID:</span> {user?.id?.substring(0, 12)}...
              </p>
              <p className="text-xs text-red-200 mt-1">
                <span className="font-semibold">Current Balance:</span> ${user?.balance?.toFixed(2)}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleContactAdmin}
                className="w-full py-3 rounded-xl bg-white text-red-600 font-semibold hover:bg-red-50 transition duration-200"
              >
                Contact Admin Support
              </button>
              
              <button
                onClick={handleRefreshFromPopup}
                className="w-full py-3 rounded-xl bg-red-500/30 text-white font-semibold hover:bg-red-500/40 transition duration-200 border border-red-500/50"
              >
                Refresh Account Status
              </button>
              
              {!showSuspendedPopup && (
                <button
                  onClick={closeSuspendedPopup}
                  className="w-full py-2 text-xs text-red-200 hover:text-white transition"
                >
                  Continue in Read-Only Mode
                </button>
              )}
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
