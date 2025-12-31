import { BalanceCard } from "@/components/wallet/BalanceCard";
import { StatsChart } from "@/components/wallet/StatsChart";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const Stats = () => {
  const { user, isLoading } = useAuth();

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Statistics</h1>
        </div>
        <BalanceCard balance={user.balance} />
        <StatsChart />
        <TransactionList />
      </div>
      <BottomNav />
    </div>
  );
};

export default Stats;
