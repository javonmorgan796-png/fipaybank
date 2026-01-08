import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  AlertCircle,
  Mail,
  ShieldAlert,
  Lock,
  RefreshCw,
  Clock,
  HelpCircle,
} from "lucide-react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const BALANCE_UPDATE_THRESHOLD = 0.01;
const REAL_TIME_CHECK_INTERVAL = 5000;
const BALANCE_UPDATE_INTERVAL = 30000;

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();

  // 🔐 Suspension control
  const [isSuspended, setIsSuspended] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  // UI state
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [lastSuspensionCheck, setLastSuspensionCheck] = useState<Date | null>(
    null
  );
  const [showSuspendedDetails, setShowSuspendedDetails] = useState(false);

  const previousBalance = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  // 💰 Balance change detector
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

  // 🔎 MAIN suspension + balance check
  const checkSuspendedStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/users/${user.id}/status`);
      if (!res.ok) return;

      const data = await res.json();

      setIsSuspended(!!data.suspended);
      setLastSuspensionCheck(new Date());

      if (
        previousBalance.current !== null &&
        Math.abs(data.balance - previousBalance.current) >
          BALANCE_UPDATE_THRESHOLD
      ) {
        handleBalanceUpdate(data.balance);
      }

      previousBalance.current = data.balance;
    } catch (err) {
      console.error("Suspension check failed:", err);
    } finally {
      setStatusChecked(true);
    }
  }, [user?.id]);

  // 🟢 Initial load
  useEffect(() => {
    if (!user?.id) return;

    previousBalance.current = user.balance ?? 0;
    setIsSuspended(!!user.suspended);

    refreshBalance();
    checkSuspendedStatus();
  }, [user?.id]);

  // 🔁 Real-time polling
  useEffect(() => {
    if (!user?.id) return;

    pollingIntervalRef.current = window.setInterval(
      checkSuspendedStatus,
      REAL_TIME_CHECK_INTERVAL
    );

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user?.id, checkSuspendedStatus]);

  // 🔄 Background balance refresh (only if NOT suspended)
  useEffect(() => {
    if (!user?.id || isSuspended) return;

    const interval = window.setInterval(
      refreshBalance,
      BALANCE_UPDATE_INTERVAL
    );
    return () => clearInterval(interval);
  }, [user?.id, isSuspended, refreshBalance]);

  const handleRefresh = async () => {
    await refreshBalance();
    setLastRefresh(new Date());
    checkSuspendedStatus();
  };

  const handleContactAdmin = () => {
    const subject = encodeURIComponent(
      "Account Suspension – Assistance Needed"
    );
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user?.id}\nEmail: ${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`);
  };

  // ⏳ WAIT until auth + suspension check is done
  if (isLoading || !statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // 🚪 Redirect ONLY if truly logged out
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 relative">
      {/* 🔔 Balance popup */}
      {balanceUpdated && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white p-4 rounded-xl shadow-xl">
          {balanceUpdateMessage}
        </div>
      )}

      {/* 🚨 Suspension modal */}
      {isSuspended && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 p-6 rounded-xl max-w-md w-full text-white">
            <div className="text-center mb-4">
              <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <h2 className="text-xl font-bold">Account Suspended</h2>
              <p className="text-gray-400 text-sm">
                Your account is under review
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleContactAdmin}
                className="w-full bg-red-600 py-2 rounded-lg"
              >
                Contact Support
              </button>

              <button
                onClick={checkSuspendedStatus}
                className="w-full bg-gray-700 py-2 rounded-lg"
              >
                Check Status
              </button>
            </div>

            {lastSuspensionCheck && (
              <p className="text-xs text-gray-500 text-center mt-4">
                Last checked:{" "}
                {lastSuspensionCheck.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 🏦 Wallet UI */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />
        <BalanceCard balance={user.balance} />
        <QuickActions disabled={isSuspended} />
        <SendMoney disabled={isSuspended} />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
