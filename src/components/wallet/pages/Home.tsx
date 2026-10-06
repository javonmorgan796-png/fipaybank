import { Header } from "@/components/wallet/Header"; 
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { ShieldAlert, CreditCard } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const BALANCE_UPDATE_THRESHOLD = 0.01;
const REAL_TIME_CHECK_INTERVAL = 5000;
const BALANCE_UPDATE_INTERVAL = 30000;

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();
  const navigate = useNavigate();

  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [lastSuspensionCheck, setLastSuspensionCheck] = useState<Date | null>(null);

  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user?.id}\nEmail: ${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleCheckStatus = async () => {
    await refreshBalance();
    checkUserStatus();
    setLastSuspensionCheck(new Date());
  };

  const handleBalanceUpdate = (newBalance: number) => {
    if (previousBalance.current === null) return;

    const diff = Math.abs(newBalance - previousBalance.current);
    if (diff < BALANCE_UPDATE_THRESHOLD) return;

    setBalanceUpdated(true);
    setBalanceUpdateMessage(
      newBalance > previousBalance.current
        ? `Your balance increased by $${diff.toFixed(2)}`
        : `Your balance decreased by $${diff.toFixed(2)}`
    );

    setTimeout(() => setBalanceUpdated(false), 5000);
  };

  const checkUserStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        headers: {
          "x-user-id": user.id,
        }
      });
      if (!res.ok) return;

      const data = await res.json();
      const userData = data.user ?? data;

      setLastSuspensionCheck(new Date());

      if (userData.suspended) {
        setShowSuspendedPopup(true);
      } else {
        setShowSuspendedPopup(false);
      }

      if (
        previousSuspendedStatus.current !== null &&
        userData.suspended !== previousSuspendedStatus.current
      ) {
        await refreshBalance();
      }

      if (
        previousBalance.current !== null &&
        Math.abs(userData.balance - previousBalance.current) > BALANCE_UPDATE_THRESHOLD
      ) {
        handleBalanceUpdate(userData.balance);
      }

      previousSuspendedStatus.current = userData.suspended;
      previousBalance.current = userData.balance;
    } catch (err) {
      console.error("Status check error:", err);
    }
  }, [user?.id, refreshBalance]);

  useEffect(() => {
    if (!user?.id) return;

    refreshBalance();
    setLastRefresh(new Date());

    previousBalance.current = user.balance ?? 0;
    previousSuspendedStatus.current = user.suspended ?? false;

    if (user.suspended) {
      setShowSuspendedPopup(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    checkUserStatus();

    pollingIntervalRef.current = window.setInterval(
      checkUserStatus,
      REAL_TIME_CHECK_INTERVAL
    );

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user?.id, checkUserStatus]);

  useEffect(() => {
    if (!user?.id || showSuspendedPopup) return;

    const interval = window.setInterval(refreshBalance, BALANCE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [user?.id, showSuspendedPopup, refreshBalance]);

  const handleRefresh = async () => {
    await refreshBalance();
    setLastRefresh(new Date());
    checkUserStatus();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen relative">
      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />

        <BalanceCard balance={user.balance} />

        {balanceUpdated && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm font-medium animate-fade-in">
            ✅ {balanceUpdateMessage}
          </div>
        )}

        <QuickActions disabled={showSuspendedPopup || !!user.suspended} />
        <SendMoney disabled={showSuspendedPopup || !!user.suspended} />

        <div className="mb-6 animate-slide-up">
          <button 
            onClick={() => navigate('/cards')}
            className="w-full p-4 rounded-2xl bg-card border border-border/50 hover:shadow-md transition-all hover:border-border"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground text-sm">My Cards</p>
                  <p className="text-xs text-muted-foreground">Manage your payment methods</p>
                </div>
              </div>
              <span className="text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded">View</span>
            </div>
          </button>
        </div>

        <TransactionList limit={2} />
      </div>

      <BottomNav />

      {showSuspendedPopup && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="h-8 w-8 text-red-500" />
              <h2 className="text-xl font-bold text-red-500">Account Suspended</h2>
            </div>

            <p className="mb-4">
              Your account has been suspended. Wallet actions are disabled.
              Please contact support for assistance.
            </p>

            <div className="space-y-1 text-sm">
              <p><strong>User ID:</strong> {user?.id}</p>
              <p><strong>Email:</strong> {user?.email}</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleContactAdmin}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Contact Admin
              </button>

              <button
                onClick={handleCheckStatus}
                className="flex-1 border py-2 rounded-lg hover:bg-secondary transition-colors font-medium"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
