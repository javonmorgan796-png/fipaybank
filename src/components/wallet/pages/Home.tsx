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
const BALANCE_CHECK_INTERVAL = 5000; // Check balance every 5 seconds
const SUSPENSION_CHECK_INTERVAL = 3000; // Check suspension every 3 seconds

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [lastBalanceCheck, setLastBalanceCheck] = useState<Date | null>(null);
  const [lastSuspensionCheck, setLastSuspensionCheck] = useState<Date | null>(null);
  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);
  const balanceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suspensionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check balance in real-time
  const checkBalanceRealTime = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const response = await fetch(`https://fipaybank.onrender.com/api/users/${user.id}/balance`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLastBalanceCheck(new Date());
        
        // Check if balance changed
        if (previousBalance.current !== null && data.balance !== previousBalance.current) {
          console.log("💰 BALANCE CHANGED DETECTED!", {
            from: previousBalance.current,
            to: data.balance,
            difference: data.balance - previousBalance.current
          });
          
          // Update local state immediately
          await refreshBalance();
          
          // Show notification
          const difference = data.balance - previousBalance.current;
          setBalanceUpdated(true);
          setBalanceUpdateMessage(
            difference > 0 
              ? `Your balance increased by $${Math.abs(difference).toFixed(2)}!`
              : `Your balance decreased by $${Math.abs(difference).toFixed(2)}`
          );
          
          setTimeout(() => {
            setBalanceUpdated(false);
          }, 5000);
        }
        
        // Check if suspension changed
        if (previousSuspendedStatus.current !== null && 
            data.suspended !== previousSuspendedStatus.current) {
          console.log("🚨 SUSPENSION STATUS CHANGED DETECTED!");
          await refreshBalance();
        }
        
        // Update refs
        previousBalance.current = data.balance;
        previousSuspendedStatus.current = data.suspended;
        
        return data;
      }
    } catch (error) {
      console.error("Error checking balance:", error);
    }
    
    return null;
  }, [user?.id, refreshBalance]);

  // Function to check ONLY suspension status
  const checkSuspensionStatus = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const response = await fetch(`https://fipaybank.onrender.com/api/users/${user.id}/suspension`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLastSuspensionCheck(new Date());
        return data.suspended || false;
      }
    } catch (error) {
      console.error("Error checking suspension:", error);
    }
    
    return null;
  }, [user?.id]);

  // Initialize refs
  useEffect(() => {
    if (user) {
      previousBalance.current = user.balance || 0;
      previousSuspendedStatus.current = user.suspended || false;
    }
  }, [user]);

  // Real-time balance monitoring
  useEffect(() => {
    if (!user?.id) return;

    console.log("💰 Starting real-time balance monitoring for user:", user.id);

    // Initial check
    checkBalanceRealTime();

    // Set up frequent checks (every 5 seconds)
    balanceCheckIntervalRef.current = setInterval(() => {
      checkBalanceRealTime();
    }, BALANCE_CHECK_INTERVAL);

    return () => {
      if (balanceCheckIntervalRef.current) {
        clearInterval(balanceCheckIntervalRef.current);
      }
    };
  }, [user?.id, checkBalanceRealTime]);

  // Real-time suspension monitoring
  useEffect(() => {
    if (!user?.id) return;

    console.log("🚨 Starting real-time suspension monitoring for user:", user.id);

    // Initial check
    checkSuspensionStatus();

    // Set up frequent checks (every 3 seconds)
    suspensionCheckIntervalRef.current = setInterval(async () => {
      const currentSuspended = user.suspended || false;
      const latestSuspended = await checkSuspensionStatus();
      
      if (latestSuspended !== null && latestSuspended !== currentSuspended) {
        console.log("⚠️ SUSPENSION STATUS CHANGED DETECTED!");
        
        if (latestSuspended) {
          console.log("🚨 USER JUST GOT SUSPENDED!");
          await refreshBalance();
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Account Suspended", {
              body: "Your account has been suspended. Please contact support.",
              icon: "/favicon.ico"
            });
          }
        } else {
          console.log("✅ USER JUST GOT UNSUSPENDED!");
          await refreshBalance();
        }
      }
    }, SUSPENSION_CHECK_INTERVAL);

    return () => {
      if (suspensionCheckIntervalRef.current) {
        clearInterval(suspensionCheckIntervalRef.current);
      }
    };
  }, [user?.id, user?.suspended, checkSuspensionStatus, refreshBalance]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    console.log("🔄 Manual refresh triggered");
    await refreshBalance();
    setLastRefresh(new Date());
    await checkBalanceRealTime();
  }, [refreshBalance, checkBalanceRealTime]);

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
      {/* Real-time monitoring indicator */}
      <div className="fixed top-4 right-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isSuspended ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span>Live: {isSuspended ? 'Suspended' : 'Active'}</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-[10px] text-blue-300">Real-time monitoring</span>
        </div>
        {lastBalanceCheck && (
          <div className="text-[10px] text-gray-300 mt-1">
            Last check: {lastBalanceCheck.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
          </div>
        )}
      </div>

      {/* Balance Update Notification */}
      {balanceUpdated && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="max-w-sm mx-4 p-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 border border-green-700 text-center shadow-2xl">
            <p className="text-sm font-bold text-white flex items-center justify-center gap-2">
              <span className="text-lg">💰</span> Balance Updated!
            </p>
            <p className="text-xs text-green-100 mt-1">
              {balanceUpdateMessage}
            </p>
            <div className="mt-2 text-xs text-green-200">
              New Balance: <span className="font-bold text-lg">${user?.balance?.toFixed(2)}</span>
            </div>
            <div className="mt-2 text-[10px] text-green-300">
              Updated just now
            </div>
          </div>
        </div>
      )}

      {/* Rest of your Home.tsx component remains the same... */}
      {/* ... (keep the suspended popup, debug panel, and other components) */}
    </div>
  );
};

export default Home;
