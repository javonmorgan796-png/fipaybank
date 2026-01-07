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
const BALANCE_UPDATE_THRESHOLD = 0.01;
const REAL_TIME_CHECK_INTERVAL = 5000;
const BALANCE_UPDATE_INTERVAL = 30000;

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [lastSuspensionCheck, setLastSuspensionCheck] = useState<Date | null>(null);

  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

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
      const res = await fetch(`/api/users/${user.id}/status`);
      if (!res.ok) return;

      const data = await res.json();
      setLastSuspensionCheck(new Date());

      if (
        previousSuspendedStatus.current !== null &&
        data.suspended !== previousSuspendedStatus.current
      ) {
        await refreshBalance();
      }

      if (
        previousBalance.current !== null &&
        Math.abs(data.balance - previousBalance.current) > BALANCE_UPDATE_THRESHOLD
      ) {
        handleBalanceUpdate(data.balance);
      }

      previousSuspendedStatus.current = data.suspended;
      previousBalance.current = data.balance;
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
    if (!user?.id || user.suspended) return;

    const interval = window.setInterval(refreshBalance, BALANCE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [user?.id, user?.suspended, refreshBalance]);

  const handleRefresh = async () => {
    await refreshBalance();
    setLastRefresh(new Date());
    checkUserStatus();
  };

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user?.id}\nEmail: ${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-background relative">
      {balanceUpdated && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white p-4 rounded-xl shadow-xl">
          <p className="font-semibold">💰 Balance Updated</p>
          <p className="text-sm">{balanceUpdateMessage}</p>
        </div>
      )}

      {user.suspended && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-red-700 p-6 rounded-xl text-white max-w-sm w-full text-center">
            <h2 className="text-xl font-bold mb-2">🚫 Account Suspended</h2>
            <p className="mb-4">Please contact support for assistance.</p>
            <button
              onClick={handleContactAdmin}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold"
            >
              Contact Admin
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />
        <BalanceCard balance={user.balance} />
        <QuickActions disabled={!!user.suspended} />
        <SendMoney disabled={!!user.suspended} />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
