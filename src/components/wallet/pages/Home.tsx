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
  HelpCircle
} from "lucide-react";

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
  const [showSuspendedDetails, setShowSuspendedDetails] = useState(false);

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
      `Hello Admin,\n\nMy account has been suspended and I need assistance.\n\nUser ID: ${user?.id}\nEmail: ${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleCheckStatus = async () => {
    await refreshBalance();
    setLastSuspensionCheck(new Date());
  };

  if (isLoading) {
    return (
      <div className="
        min-h-screen flex items-center justify-center
        bg-gradient-to-b from-gray-50 to-gray-100
        dark:from-gray-900 dark:to-gray-950
        text-gray-700 dark:text-gray-300
      ">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading your wallet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="
      min-h-screen relative
      bg-gradient-to-b from-gray-50 to-gray-100
      dark:from-gray-900 dark:to-gray-950
      text-gray-900 dark:text-gray-100
    ">
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
