import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Home = () => {
  const { user, isLoading, isRefreshing, refreshUserBalance } = useAuth();
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user?.id) return;

    // Initial refresh
    refreshUserBalance();

    // Set up interval for balance updates (every 10 seconds)
    refreshIntervalRef.current = setInterval(() => {
      refreshUserBalance();
    }, 10000);

    // Cleanup
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [user?.id, refreshUserBalance]);

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
    return <Navigate to="/signin" replace />;
  }

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleManualRefresh = () => {
    refreshUserBalance();
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Loading overlay during refresh */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
          Updating...
        </div>
      )}

      {/* 🚫 ACCOUNT SUSPENDED OVERLAY */}
      {user.suspended && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-sm w-full mx-4 p-6 rounded-2xl bg-red-600 border border-red-700 text-center shadow-2xl animate-fade-in">
            <p className="text-lg font-bold text-white mb-2">
              🚫 Account Suspended
            </p>
            <p className="text-sm text-red-100 mb-4">
              Your account has been suspended by the administrator.
              Please contact support for assistance.
            </p>
            <button
              onClick={handleContactAdmin}
              className="w-full py-2 rounded-xl bg-white text-red-600 font-semibold hover:bg-red-100 transition"
            >
              Contact Admin
            </button>
          </div>
        </div>
      )}

      {/* 🏦 WALLET */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleManualRefresh} />
        <BalanceCard balance={user.balance} />
        <QuickActions />
        <SendMoney />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
