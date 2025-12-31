import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useDeposits } from "@/contexts/DepositsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TransactionDetailDialog } from "./TransactionDetailDialog";

interface TransactionListProps {
  limit?: number;
}

export const TransactionList = ({ limit }: TransactionListProps) => {
  const { transactions } = useWallet();
  const { deposits } = useDeposits();
  const { user } = useAuth();
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
  
  const displayItems = limit ? allItems.slice(0, limit) : allItems;

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
    <div className="py-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
        <button 
          onClick={() => navigate('/transactions')}
          className="text-sm font-medium text-accent hover:underline"
        >
          See all
        </button>
      </div>
      <div className="space-y-3">
        {displayItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Send or receive money to see transactions here
            </p>
          </div>
        ) : (
          displayItems.map((item) => (
            item.itemType === 'deposit' ? (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="flex items-center gap-4 p-3 rounded-xl bg-card card-shadow hover:shadow-md transition-shadow cursor-pointer"
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
                className="flex items-center gap-4 p-3 rounded-xl bg-card card-shadow hover:shadow-md transition-shadow cursor-pointer"
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

      <TransactionDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selectedTransaction}
        deposit={selectedDeposit}
      />
    </div>
  );
};
