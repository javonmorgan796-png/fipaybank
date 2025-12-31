import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface BalanceCardProps {
  balance: number;
}

export const BalanceCard = ({ balance }: BalanceCardProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="text-center py-6 animate-fade-in">
      <p className="text-muted-foreground text-sm font-medium mb-2">Total Balance</p>
      <div className="flex items-center justify-center gap-3">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
          {isVisible ? formatBalance(balance) : '*****'}
        </h1>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="p-2 rounded-full hover:bg-secondary transition-colors"
          aria-label={isVisible ? "Hide balance" : "Show balance"}
        >
          {isVisible ? (
            <Eye className="w-5 h-5 text-muted-foreground" />
          ) : (
            <EyeOff className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
};
