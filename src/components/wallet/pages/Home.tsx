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
  const [hasNotificationBeenShown, setHasNotificationBeenShown] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);
  const balanceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suspensionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const wsUrl = `wss://${window.location.hostname.replace('http://', '').replace('https://', '')}/ws?userId=${user.id}`;
    const socket = new WebSocket(wsUrl);

    wsRef.current = socket;

    socket.onopen = () => {
      console.log('🔌 WebSocket connected');
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data);

        if (data.type === 'balance_update') {
          console.log('💰 REAL-TIME BALANCE UPDATE:', data);
          
          // Refresh balance to update UI
          refreshBalance();
          
          // Show notification
          if (data.amountChanged !== 0) {
            setBalanceUpdated(true);
            setBalanceUpdateMessage(
              data.amountChanged > 0 
                ? `Your balance increased by $${Math.abs(data.amountChanged).toFixed(2)}!`
                : `Your balance decreased by $${Math.abs(data.amountChanged).toFixed(2)}`
            );
            
            setTimeout(() => {
              setBalanceUpdated(false);
            }, 5000);
          }
        }

        if (data.type === 'suspension_update') {
          console.log('🚨 REAL-TIME SUSPENSION UPDATE:', data);
          
          // Refresh user data
          refreshBalance();
          
          // Show browser notification
          if (data.suspended && "Notification" in window && Notification.permission === "granted") {
            new Notification("Account Suspended", {
              body: "Your account has been suspended. Please contact support.",
              icon: "/favicon.ico"
            });
          }
          
          // Reset notification flag
          setHasNotificationBeenShown(false);
        }

        if (data.type === 'pong') {
          console.log('🏓 WebSocket heartbeat received');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    socket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setWsConnected(false);
      
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        console.log('🔄 Attempting WebSocket reconnection...');
      }, 5000);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [user?.id, refreshBalance]);

  // Function to check balance in real-time (polling fallback)
  const checkBalanceRealTime = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const response = await fetch(`/api/users/${user.id}/balance`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLastBalanceCheck(new Date());
        
        // Check if balance changed
        if (previousBalance.current !== null && data.balance !== previousBalance.current) {
          console.log("💰 BALANCE CHANGED DETECTED VIA POLLING!", {
            from: previousBalance.current,
            to: data.balance,
            difference: data.balance - previousBalance.current
          });
          
          // Update local state immediately
          await refreshBalance();
          
          // Show notification (only if not already shown via WebSocket)
          const difference = data.balance - previousBalance.current;
          if (Math.abs(difference) > 0.01) { // Only show for significant changes
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
        }
        
        // Update ref
        previousBalance.current = data.balance;
        
        return data;
      }
    } catch (error) {
      console.error("Error checking balance:", error);
    }
    
    return null;
  }, [user?.id, refreshBalance]);

  // Function to check ONLY suspension status (polling fallback)
  const checkSuspensionStatus = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const response = await fetch(`/api/users/${user.id}/suspension`, {
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

  // Real-time balance monitoring (polling fallback)
  useEffect(() => {
    if (!user?.id) return;

    console.log("💰 Starting real-time balance monitoring for user:", user.id);

    // Initial check
    checkBalanceRealTime();

    // Set up frequent checks (every 5 seconds) as fallback
    balanceCheckIntervalRef.current = setInterval(() => {
      checkBalanceRealTime();
    }, BALANCE_CHECK_INTERVAL);

    return () => {
      if (balanceCheckIntervalRef.current) {
        clearInterval(balanceCheckIntervalRef.current);
      }
    };
  }, [user?.id, checkBalanceRealTime]);

  // Real-time suspension monitoring (polling fallback)
  useEffect(() => {
    if (!user?.id) return;

    console.log("🚨 Starting real-time suspension monitoring for user:", user.id);

    // Initial check
    checkSuspensionStatus();

    // Set up frequent checks (every 3 seconds) as fallback
    suspensionCheckIntervalRef.current = setInterval(async () => {
      const currentSuspended = user.suspended || false;
      const latestSuspended = await checkSuspensionStatus();
      
      if (latestSuspended !== null && latestSuspended !== currentSuspended) {
        console.log("⚠️ SUSPENSION STATUS CHANGED DETECTED VIA POLLING!");
        
        if (latestSuspended) {
          console.log("🚨 USER JUST GOT SUSPENDED VIA POLLING!");
          await refreshBalance();
          setHasNotificationBeenShown(false); // Reset to show popup
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Account Suspended", {
              body: "Your account has been suspended. Please contact support.",
              icon: "/favicon.ico"
            });
          }
        } else {
          console.log("✅ USER JUST GOT UNSUSPENDED VIA POLLING!");
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

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    console.log("🔄 Manual refresh triggered");
    await refreshBalance();
    setLastRefresh(new Date());
    await checkBalanceRealTime();
  }, [refreshBalance, checkBalanceRealTime]);

  const handleContactAdmin = () => {
    if (!user) return;
    
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

  // Safely get suspended status with fallback
  const isSuspended = user.suspended || false;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Real-time monitoring indicator */}
      <div className="fixed top-4 right-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isSuspended ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span>Status: {isSuspended ? 'Suspended' : 'Active'}</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <div className={`w-1 h-1 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
          <span className="text-[10px]">
            {wsConnected ? 'Live updates' : 'Polling updates'}
          </span>
        </div>
        {lastBalanceCheck && (
          <div className="text-[10px] text-gray-300 mt-1">
            Last check: {lastBalanceCheck.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        )}
      </div>

      {/* Debug panel */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div className="font-mono">
          <div>ID: {user?.id?.substring(0, 8)}...</div>
          <div>💰 ${user?.balance?.toFixed(2)}</div>
          <div className={`${isSuspended ? 'text-red-400' : 'text-green-400'}`}>
            {isSuspended ? '🚫 SUSPENDED' : '✅ Active'}
          </div>
          <div className="text-gray-400">
            WS: {wsConnected ? '✅' : '❌'}
          </div>
          {lastRefresh && (
            <div className="text-gray-300">
              Refreshed: {lastRefresh.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          )}
        </div>
        <button 
          onClick={handleRefresh}
          className="mt-2 px-3 py-1 bg-blue-600 rounded text-xs hover:bg-blue-700 transition w-full"
        >
          Refresh Now
        </button>
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

      {/* Suspended Popup */}
      {isSuspended && !hasNotificationBeenShown && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 border border-red-700 text-center shadow-2xl animate-pulse-once">
            {/* Blinking alert indicator */}
            <div className="absolute -top-2 -right-2">
              <div className="relative">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-3xl">🚫</span>
            </div>
            
            <p className="text-2xl font-bold text-white mb-2 animate-pulse">
              ACCOUNT SUSPENDED
            </p>
            
            <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/40">
              <p className="text-sm text-red-100 mb-3">
                ⚠️ Your account has been <span className="font-bold">SUSPENDED</span> by the administrator.
              </p>
              <div className="text-left space-y-1">
                <p className="text-xs text-red-200">
                  <span className="font-semibold">User:</span> {user?.email}
                </p>
                <p className="text-xs text-red-200">
                  <span className="font-semibold">Balance:</span> ${user?.balance?.toFixed(2)}
                </p>
                <p className="text-xs text-red-200">
                  <span className="font-semibold">Time:</span> {new Date().toLocaleTimeString()}
                </p>
                {user.suspensionReason && (
                  <p className="text-xs text-red-200">
                    <span className="font-semibold">Reason:</span> {user.suspensionReason}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  handleContactAdmin();
                  setHasNotificationBeenShown(true);
                }}
                className="w-full py-4 rounded-xl bg-white text-red-600 font-bold hover:bg-red-50 transition duration-200 text-lg"
              >
                📧 CONTACT ADMIN NOW
              </button>
              
              <button
                onClick={handleRefresh}
                className="w-full py-3 rounded-xl bg-red-500/40 text-white font-semibold hover:bg-red-500/50 transition duration-200 border border-red-500/60"
              >
                🔄 Refresh Status
              </button>
              
              <button
                onClick={() => setHasNotificationBeenShown(true)}
                className="w-full py-2 text-sm text-red-300 hover:text-white transition"
              >
                Continue in Read-Only Mode
              </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-red-500/30">
              <p className="text-xs text-red-300">
                ⚡ <span className="font-semibold">Real-time detection:</span> {wsConnected ? 'Instant' : 'Polling every 3s'}
              </p>
              <p className="text-[10px] text-red-400 mt-1">
                Last checked: {lastSuspensionCheck?.toLocaleTimeString() || 'Just now'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      
      <BottomNav />
    </div>
  );
};

export default Home;
