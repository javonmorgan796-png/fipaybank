import { useState, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const periods = ["1M", "3M", "6M", "1Y"];

export const StatsChart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("3M");
  const { transactions } = useWallet();
  const { user } = useAuth();

  const chartData = useMemo(() => {
    const now = new Date();
    const monthsToShow = selectedPeriod === "1M" ? 1 : selectedPeriod === "3M" ? 3 : selectedPeriod === "6M" ? 6 : 12;
    
    const data = [];
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      // Calculate total for this month from transactions
      const monthTransactions = transactions.filter(t => 
        isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
      );
      
      const received = monthTransactions
        .filter(t => t.type === 'receive')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const sent = monthTransactions
        .filter(t => t.type === 'send')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      data.push({
        month: format(monthDate, "MMM"),
        received,
        sent,
        net: received - sent,
      });
    }
    
    // If no transactions, show current balance as a baseline
    if (transactions.length === 0 && user?.balance) {
      return data.map((d, i) => ({
        ...d,
        received: i === data.length - 1 ? user.balance : 0,
      }));
    }
    
    return data;
  }, [transactions, selectedPeriod, user?.balance]);

  return (
    <div className="py-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
      <h2 className="text-lg font-semibold text-foreground mb-4">Overview</h2>
      <div className="bg-card rounded-2xl p-4 card-shadow">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis hide />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border px-3 py-2 rounded-lg text-sm shadow-lg">
                        <p className="font-semibold text-foreground mb-1">{label}</p>
                        <p className="text-green-500">Received: ${payload[0]?.value?.toLocaleString() || 0}</p>
                        <p className="text-destructive">Sent: ${payload[1]?.value?.toLocaleString() || 0}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="received"
                stroke="hsl(142, 71%, 45%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceived)"
              />
              <Area
                type="monotone"
                dataKey="sent"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSent)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex justify-center gap-2 mt-4">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedPeriod === period
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-foreground hover:bg-muted'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
        
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-muted-foreground">Received</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive"></div>
            <span className="text-muted-foreground">Sent</span>
          </div>
        </div>
      </div>
    </div>
  );
};
