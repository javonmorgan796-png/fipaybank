import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Home = () => {
  const { user, isLoading, refreshUser } = useAuth();

  useEffect(() => {
    if (!user || !user.id) return;

    // ✅ Immediately fetch fresh balance when page loads
    refreshUser();

    // ✅ Safe interval refresh (every 10 seconds)
    const timer = setInterval(() => {
      refreshUser();
    }, 10000);

    return () => clearInterval(timer);
  }, [user?.id, refreshUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-background relative">
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
        <Header />
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
