import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShieldAlert, Mail, RefreshCw, Lock } from "lucide-react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const CHECK_INTERVAL = 1000; // ⏱ 1 second

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();

  const [isSuspended, setIsSuspended] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // ✅ CORRECT STATUS CHECK
  const checkSuspendedStatus = async () => {
    try {
      const res = await fetch("https://fipay.onrender.com/api/users/me", {
        credentials: "include",
      });

      // 🚨 If endpoint missing, stop polling
      if (res.status === 404) {
        console.error("❌ /api/users/me does not exist");
        setStatusChecked(true);
        return;
      }

      if (!res.ok) return;

      const data = await res.json();

      setIsSuspended(!!data.suspended);
      setLastChecked(new Date());
      setStatusChecked(true);
    } catch (err) {
      console.error("Status check failed:", err);
    }
  };

  // 🔁 Poll every second
  useEffect(() => {
    checkSuspendedStatus();

    const interval = setInterval(
      checkSuspendedStatus,
      CHECK_INTERVAL
    );

    return () => clearInterval(interval);
  }, []);

  // 🔄 Balance refresh
  useEffect(() => {
    if (!user) return;
    refreshBalance();
  }, [user]);

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension Help");
    const body = encodeURIComponent(
      `Hello Support,\n\nMy account is suspended.\n\nEmail: ${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`);
  };

  // ⛔ DO NOT redirect until status is checked
  if (isLoading || !statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // 🚪 Redirect only if truly logged out
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* 🚨 Suspension Popup */}
      {isSuspended && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 text-white p-6 rounded-xl max-w-sm w-full">
            <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-center">
              Account Suspended
            </h2>
            <p className="text-gray-400 text-sm text-center mb-4">
              Your account is under review
            </p>

            <button
              onClick={handleContactAdmin}
              className="w-full bg-red-600 py-2 rounded-lg mb-2"
            >
              <Mail className="inline h-4 w-4 mr-1" />
              Contact Support
            </button>

            <button
              onClick={checkSuspendedStatus}
              className="w-full bg-gray-700 py-2 rounded-lg"
            >
              <RefreshCw className="inline h-4 w-4 mr-1" />
              Check Status
            </button>

            {lastChecked && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 🏦 Wallet UI */}
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
                Transactions disabled
              </p>
            </div>
          </div>
        )}

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
