import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight, ArrowDownLeft, Wallet, Calendar, User, Hash, CheckCircle, Clock, XCircle } from "lucide-react";

interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  recipientName?: string;
  recipientEmail?: string;
  senderName?: string;
  senderEmail?: string;
  counterpartyName?: string;
  counterpartyEmail?: string;
  date: string;
  status: string;
}

interface Deposit {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  crypto: string;
  amount: number;
  address: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  deposit?: Deposit | null;
}

export const TransactionDetailDialog = ({ 
  open, 
  onOpenChange, 
  transaction, 
  deposit 
}: TransactionDetailDialogProps) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  if (transaction) {
    const isOutgoing = transaction.type === 'send';
    const counterpartyName = isOutgoing
      ? (transaction.recipientName || transaction.counterpartyName || 'Unknown recipient')
      : (transaction.senderName || transaction.counterpartyName || 'Unknown sender');
    const counterpartyEmail = isOutgoing
      ? (transaction.recipientEmail || transaction.counterpartyEmail || 'No email provided')
      : (transaction.senderEmail || transaction.counterpartyEmail || 'No email provided');

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Transaction Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Icon and Amount */}
            <div className="flex flex-col items-center gap-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isOutgoing ? 'bg-red-500/10' : 'bg-green-500/10'
              }`}>
                {isOutgoing ? (
                  <ArrowUpRight className="w-8 h-8 text-red-500" />
                ) : (
                  <ArrowDownLeft className="w-8 h-8 text-green-500" />
                )}
              </div>
              <p className={`text-3xl font-bold ${isOutgoing ? 'text-red-500' : 'text-green-500'}`}>
                {isOutgoing ? '-' : '+'}{formatAmount(transaction.amount)}
              </p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                transaction.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
              }`}>
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-4 bg-secondary/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {isOutgoing ? 'Sent to' : 'Received from'}
                  </p>
                  <p className="font-medium text-foreground">
                    {counterpartyName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {counterpartyEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium text-foreground">{formatDate(transaction.date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Transaction ID</p>
                  <p className="font-medium text-foreground text-sm">{transaction.id}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (deposit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Deposit Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Icon and Amount */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-primary/10">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatAmount(deposit.amount)}
              </p>
              <div className="flex items-center gap-2">
                {getStatusIcon(deposit.status)}
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                  deposit.status === 'approved' ? 'bg-green-500/10 text-green-500' : 
                  deposit.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 
                  'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {deposit.status}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4 bg-secondary/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Cryptocurrency</p>
                  <p className="font-medium text-foreground">{deposit.crypto}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium text-foreground">{formatDate(deposit.date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Deposit ID</p>
                  <p className="font-medium text-foreground text-sm">{deposit.id}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Hash className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Wallet Address</p>
                  <p className="font-medium text-foreground text-xs break-all">{deposit.address}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};
