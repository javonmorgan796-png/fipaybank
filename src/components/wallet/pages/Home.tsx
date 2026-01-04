import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/NewAuthContext"; // Use the new context
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Simple refresh on mount
  useEffect(() => {
    if (user?.id) {
      console.log("🏠 Home mounted, refreshing balance...");
      refreshBalance();
      setLastRefresh(new Date());
    }
  }, [user?.id]);

  // Manual refresh handler
  const handleRefresh = () => {
    refreshBalance();
    setLastRefresh(new Date());
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

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended.\n\nUser ID: ${user.id}\nEmail: ${user.email}\n\nPlease assist.\n\nThank you.`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Simple debug info */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/70 text-white text-xs p-2 rounded">
        <div>User: {user?.id?.substring(0, 8)}...</div>
        <div>Balance: ${user?.balance}</div>
        {lastRefresh && (
          <div>Last refresh: {lastRefresh.toLocaleTimeString()}</div>
        )}
        <button 
          onClick={handleRefresh}
          className="mt-1 px-2 py-1 bg-blue-500 rounded text-xs"
        >
          Refresh
        </button>
      </div>

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

      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />
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
