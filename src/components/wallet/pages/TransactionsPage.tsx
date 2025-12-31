import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { BottomNav } from "@/components/wallet/BottomNav";
import { TransactionDetailDialog } from "@/components/wallet/TransactionDetailDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useDeposits } from "@/contexts/DepositsContext";
import { Navigate } from "react-router-dom";

const TransactionsPage = () => {
  const { user, isLoading } = useAuth();
  const { transactions } = useWallet();
  const { deposits } = useDeposits();
  const navigate = useNavigate();

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const userDeposits = deposits.filter(d => d.userId === user?.id);

  // Combine and sort by date
  const allItems = [
    ...transactions.map(t => ({ ...t, itemType: 'transaction' as const })),
    ...userDeposits.map(d => ({ ...d, itemType: 'deposit' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  const formatAmount = (amount: number, isDeposit = false) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
    if (isDeposit) return `+${formatted}`;
    return amount < 0 ? `-${formatted}` : `+${formatted}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }
  };

  const handleItemClick = (item: any) => {
    if (item.itemType === 'deposit') {
      setSelectedDeposit(item);
      setSelectedTransaction(null);
    } else {
      setSelectedTransaction(item);
      setSelectedDeposit(null);
    }
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 flex items-center gap-4 animate-fade-in">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">All Transactions</h1>
        </div>

        <div className="mt-6 space-y-3 animate-slide-up">
          {allItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your transactions will appear here
              </p>
            </div>
          ) : (
            allItems.map((item) => (
              item.itemType === 'deposit' ? (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card card-shadow hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {item.crypto} Deposit
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {formatAmount(item.amount, true)}
                    </p>
                    <p className={`text-xs capitalize ${
                      item.status === 'approved' ? 'text-green-500' : 
                      item.status === 'rejected' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      {item.status}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card card-shadow hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    item.type === 'send' ? 'bg-red-500/10' : 'bg-green-500/10'
                  }`}>
                    {item.type === 'send' ? (
                      <ArrowUpRight className="w-6 h-6 text-red-500" />
                    ) : (
                      <ArrowDownLeft className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {item.type === 'send' 
                        ? `Sent to ${item.recipientName}`
                        : `Received from ${item.senderName}`
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${item.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {formatAmount(item.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{item.status}</p>
                  </div>
                </div>
              )
            ))
          )}
        </div>
      </div>
      <BottomNav />

      <TransactionDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selectedTransaction}
        deposit={selectedDeposit}
      />
    </div>
  );
};

export default TransactionsPage;
