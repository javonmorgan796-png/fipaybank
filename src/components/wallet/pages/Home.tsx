import { Header } from "@/components/wallet/Header";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { SendMoney } from "@/components/wallet/SendMoney";
import { TransactionList } from "@/components/wallet/TransactionList";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { 
  AlertCircle, 
  Mail, 
  ShieldAlert, 
  Lock, 
  RefreshCw,
  Clock,
  HelpCircle
} from "lucide-react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const BALANCE_UPDATE_THRESHOLD = 0.01;
const REAL_TIME_CHECK_INTERVAL = 5000;
const BALANCE_UPDATE_INTERVAL = 30000;

const Home = () => {
  const { user, isLoading, refreshBalance } = useAuth();

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [balanceUpdated, setBalanceUpdated] = useState(false);
  const [balanceUpdateMessage, setBalanceUpdateMessage] = useState("");
  const [lastSuspensionCheck, setLastSuspensionCheck] = useState<Date | null>(null);
  const [showSuspendedDetails, setShowSuspendedDetails] = useState(false);

  const previousBalance = useRef<number | null>(null);
  const previousSuspendedStatus = useRef<boolean | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  const handleBalanceUpdate = (newBalance: number) => {
    if (previousBalance.current === null) return;

    const diff = Math.abs(newBalance - previousBalance.current);
    if (diff < BALANCE_UPDATE_THRESHOLD) return;

    setBalanceUpdated(true);
    setBalanceUpdateMessage(
      newBalance > previousBalance.current
        ? `Your balance increased by $${diff.toFixed(2)}`
        : `Your balance decreased by $${diff.toFixed(2)}`
    );

    setTimeout(() => setBalanceUpdated(false), 5000);
  };

  const checkUserStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/users/${user.id}/status`);
      if (!res.ok) return;

      const data = await res.json();
      setLastSuspensionCheck(new Date());

      if (
        previousSuspendedStatus.current !== null &&
        data.suspended !== previousSuspendedStatus.current
      ) {
        await refreshBalance();
      }

      if (
        previousBalance.current !== null &&
        Math.abs(data.balance - previousBalance.current) > BALANCE_UPDATE_THRESHOLD
      ) {
        handleBalanceUpdate(data.balance);
      }

      previousSuspendedStatus.current = data.suspended;
      previousBalance.current = data.balance;
    } catch (err) {
      console.error("Status check error:", err);
    }
  }, [user?.id, refreshBalance]);

  useEffect(() => {
    if (!user?.id) return;

    refreshBalance();
    setLastRefresh(new Date());

    previousBalance.current = user.balance ?? 0;
    previousSuspendedStatus.current = user.suspended ?? false;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    checkUserStatus();

    pollingIntervalRef.current = window.setInterval(
      checkUserStatus,
      REAL_TIME_CHECK_INTERVAL
    );

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user?.id, checkUserStatus]);

  useEffect(() => {
    if (!user?.id || user.suspended) return;

    const interval = window.setInterval(refreshBalance, BALANCE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [user?.id, user?.suspended, refreshBalance]);

  const handleRefresh = async () => {
    await refreshBalance();
    setLastRefresh(new Date());
    checkUserStatus();
  };

  const handleContactAdmin = () => {
    const subject = encodeURIComponent("Account Suspension – Assistance Needed");
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy account has been suspended and I need assistance.\n\nUser ID: ${user?.id}\nEmail: ${user?.email}\n\nCould you please provide information on:\n1. The reason for suspension\n2. Steps to resolve this issue\n3. Expected timeframe for resolution\n\nThank you,\n${user?.email}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleCheckStatus = async () => {
    await refreshBalance();
    setLastSuspensionCheck(new Date());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 relative">
      {balanceUpdated && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-xl shadow-xl max-w-md w-[90%] animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Balance Updated</p>
              <p className="text-xs opacity-90">{balanceUpdateMessage}</p>
            </div>
            <button 
              onClick={() => setBalanceUpdated(false)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {user.suspended && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-black/90 via-black/80 to-black/90 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 p-6 rounded-2xl text-white max-w-md w-full shadow-2xl animate-scale-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full mb-4">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Account Suspended</h2>
              <p className="text-gray-300 text-sm">Your account access has been temporarily restricted</p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Temporary Restriction</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Your account is currently under review for security purposes. This is a temporary measure to protect your funds.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <Lock className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Limited Access</p>
                  <p className="text-gray-400 text-xs mt-1">
                    You can view your balance but transactions are temporarily disabled until the review is complete.
                  </p>
                </div>
              </div>

              {lastSuspensionCheck && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Last Checked</p>
                    <p className="text-gray-400 text-xs">
                      {lastSuspensionCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleContactAdmin}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              >
                <Mail className="h-5 w-5" />
                Contact Support
              </button>

              <button
                onClick={handleCheckStatus}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              >
                <RefreshCw className="h-5 w-5" />
                Check Status
              </button>

              <button
                onClick={() => setShowSuspendedDetails(!showSuspendedDetails)}
                className="w-full text-gray-400 hover:text-gray-300 py-2 text-sm flex items-center justify-center gap-1"
              >
                <HelpCircle className="h-4 w-4" />
                Why was my account suspended?
              </button>
            </div>

            {showSuspendedDetails && (
              <div className="mt-4 p-4 bg-gray-800/30 rounded-lg animate-fade-in">
                <h4 className="font-semibold text-sm mb-2">Common Reasons for Suspension:</h4>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Unusual login activity detected</li>
                  <li>• Suspicious transaction patterns</li>
                  <li>• Verification process required</li>
                  <li>• Security protocol activation</li>
                </ul>
                <p className="text-gray-500 text-xs mt-3">
                  Support typically responds within 24-48 hours.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 pb-24">
        <Header onRefresh={handleRefresh} />
        
        {user.suspended && (
          <div className="mb-4 p-4 bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm">Account Restricted</p>
                <p className="text-red-600 text-xs">Transactions temporarily disabled</p>
              </div>
            </div>
          </div>
        )}

        <BalanceCard balance={user.balance} />
        <QuickActions disabled={!!user.suspended} />
        <SendMoney disabled={!!user.suspended} />
        <TransactionList limit={2} />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
