import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Mail,
  RefreshCw,
  Lock,
} from "lucide-react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const SUSPENSION_CHECK_INTERVAL = 1000; // 🔁 1 second

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();

  // 🔐 Suspension state
  const [isSuspended, setIsSuspended] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // 🔎 Check suspension (FORCED)
  const checkSuspendedStatus = async () => {
    try {
      if (!user?.id) return;

      const res = await fetch(`/api/users/${user.id}/status`);
      if (!res.ok) return;

      const data = await res.json();

      setIsSuspended(!!data.suspended);
      setLastChecked(new Date());
      setStatusChecked(true);
    } catch (err) {
      console.error("Suspension check failed:", err);
    }
  };

  // 🔁 Run every second
  useEffect(() => {
    if (!user?.id) return;

    checkSuspendedStatus();

    const interval = setInterval(
      checkSuspendedStatus,
      SUSPENSION_CHECK_INTERVAL
    );

    return () => clearInterval(interval);
  }, [user?.id]);

  // 🔄 Balance refresh (even if suspended, once on load)
  useEffect(() => {
    if (!user?.id) return;
    refreshBalance();
  }, [user?.id]);

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension Help");
    const body = encodeURIComponent(
      `Hello Support,\n\nMy account is suspended.\n\nUser ID: ${user?.id}\nEmail: ${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`);
  };

  // ⛔ HARD BLOCK redirect until suspension checked
  if (isLoading || !statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // 🚪 Redirect ONLY when truly logged out
  if (!user && statusChecked) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* 🚨 SUSPENSION POPUP */}
      {isSuspended && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 text-white p-6 rounded-xl max-w-sm w-full shadow-2xl">
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
                className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </button>

              <button
                onClick={checkSuspendedStatus}
                className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Check Status
              </button>
            </div>

            {lastChecked && (
              <p className="text-xs text-gray-500 text-center mt-4">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 🏦 WALLET UI */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={refreshBalance} />

        {isSuspended && (
          <div className="mb-4 p-4 bg-red-100 border border-red-200 rounded-xl flex items-center gap-3">
            <Lock className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                Account Restricted
              </p>
              <p className="text-xs text-red-600">
                Transactions are disabled
              </p>
            </div>
          </div>
        )}

        <BalanceCard balance={user?.balance ?? 0} />
        <QuickActions disabled={isSuspended} />
        <SendMoney disabled={isSuspended} />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
