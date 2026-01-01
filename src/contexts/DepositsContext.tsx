import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

export interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  crypto: string;
  symbol: string;
  amount: number;
  cryptoAmount: string;
  address: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface DepositsContextType {
  deposits: Deposit[];
  userDeposits: Deposit[];
  allDeposits: Deposit[];
  addDeposit: (deposit: Omit<Deposit, 'id' | 'userId' | 'userEmail' | 'userName'>) => void;
  approveDeposit: (depositId: string) => void;
  rejectDeposit: (depositId: string) => void;
}

const DepositsContext = createContext<DepositsContextType | undefined>(undefined);

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
const ADMIN_EMAIL = 'javonmorgan796@gmail.com';

export const DepositsProvider = ({ children }: { children: ReactNode }) => {
  const { user, updateBalance } = useAuth();
  const { addNotification } = useNotifications();
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  // Fetch deposits from server (all for admin, otherwise only user deposits)
  useEffect(() => {
    const fetchDeposits = async () => {
      try {
        const url = user
          ? `${API_BASE}/api/deposits${user.email === ADMIN_EMAIL ? '' : `?userId=${user.id}`}`
          : `${API_BASE}/api/deposits`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error('Failed to fetch deposits');
          return;
        }
        const data = await res.json();
        const serverDeposits = (data.deposits || []).map((d: any) => ({
          id: d._id || d.id,
          userId: d.userId,
          userEmail: d.userEmail,
          userName: d.userName,
          crypto: d.crypto,
          symbol: d.symbol,
          amount: d.amount,
          cryptoAmount: d.cryptoAmount || d.cryptoAmount,
          address: d.address || '',
          date: d.date || d.createdAt,
          status: d.status,
        } as Deposit));
        setDeposits(serverDeposits);
      } catch (err) {
        console.error('fetch deposits error', err);
      }
    };

    fetchDeposits();
  }, [user]);

  const addDeposit = async (deposit: Omit<Deposit, 'id' | 'userId' | 'userEmail' | 'userName'>) => {
    if (!user) return;
    try {
      const body = { ...deposit, userId: user.id, userEmail: user.email, userName: user.name };
      const res = await fetch(`${API_BASE}/api/deposits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to create deposit', err);
        return;
      }
      const data = await res.json();
      const d = data.deposit;
      const newDeposit: Deposit = {
        id: d._id || d.id || crypto.randomUUID(),
        userId: d.userId,
        userEmail: d.userEmail,
        userName: d.userName,
        crypto: d.crypto,
        symbol: d.symbol,
        amount: d.amount,
        cryptoAmount: d.cryptoAmount || '',
        address: d.address || '',
        date: d.date || d.createdAt || new Date().toISOString(),
        status: d.status || 'pending',
      };
      setDeposits(prev => [newDeposit, ...prev]);
    } catch (err) {
      console.error('addDeposit error', err);
    }
  };

  const approveDeposit = async (depositId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/deposits/${depositId}/approve`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        console.error('approve failed', data);
        return;
      }
      const updatedDeposit = data.deposit;

      setDeposits(prev => prev.map(d => (d.id === updatedDeposit._id || d.id === updatedDeposit.id ? {
        ...d,
        status: updatedDeposit.status,
        date: updatedDeposit.date || d.date,
      } : d)));

      // If the affected user is the current user, update their balance
      if (data.user && user && data.user.email === user.email) {
        updateBalance(data.user.balance);
      } else {
        const dep = deposits.find(d => d.id === depositId);
        if (dep && user && user.email === dep.userEmail) {
          updateBalance(user.balance + dep.amount);
        }
      }

      // Add notification
      const depForNotif = deposits.find(d => d.id === depositId);
      if (depForNotif) {
        addNotification({
          title: 'Deposit Approved!',
          message: `Your ${depForNotif.symbol} deposit of $${depForNotif.amount.toLocaleString()} has been approved and added to your balance.`,
          type: 'deposit',
          amount: depForNotif.amount,
          targetUserId: depForNotif.userId,
        });
      }
    } catch (err) {
      console.error('approveDeposit error', err);
    }
  };

  const rejectDeposit = async (depositId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/deposits/${depositId}/reject`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        console.error('reject failed', data);
        return;
      }
      const updatedDeposit = data.deposit;

      setDeposits(prev => prev.map(d => (d.id === updatedDeposit._id || d.id === updatedDeposit.id ? {
        ...d,
        status: updatedDeposit.status,
      } : d)));

      const depForNotif = deposits.find(d => d.id === depositId);
      if (depForNotif) {
        addNotification({
          title: 'Deposit Rejected',
          message: `Your ${depForNotif.symbol} deposit of $${depForNotif.amount.toLocaleString()} has been rejected. Please contact support.`,
          type: 'deposit',
          amount: depForNotif.amount,
          targetUserId: depForNotif.userId,
        });
      }
    } catch (err) {
      console.error('rejectDeposit error', err);
    }
  };

  const userDeposits = user ? deposits.filter(d => d.userId === user.id) : [];
  const allDeposits = deposits;

  return (
    <DepositsContext.Provider value={{ 
      deposits, 
      userDeposits, 
      allDeposits, 
      addDeposit, 
      approveDeposit, 
      rejectDeposit 
    }}>
      {children}
    </DepositsContext.Provider>
  );
};

export const useDeposits = () => {
  const context = useContext(DepositsContext);
  if (!context) {
    throw new Error('useDeposits must be used within a DepositsProvider');
  }
  return context;
};
