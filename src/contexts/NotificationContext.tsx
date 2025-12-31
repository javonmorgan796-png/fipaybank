import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  type: 'money_received' | 'money_sent' | 'system' | 'deposit';
  title: string;
  message: string;
  date: string;
  read: boolean;
  amount?: number;
  senderName?: string;
}

interface AddNotificationParams {
  title: string;
  message: string;
  type: 'money_received' | 'money_sent' | 'system' | 'deposit';
  amount?: number;
  targetUserId?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  addNotification: (params: AddNotificationParams) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATIONS_KEY = 'wallet_notifications';

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (user) {
      const savedNotifications = localStorage.getItem(`${NOTIFICATIONS_KEY}_${user.id}`);
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }
    }
  }, [user]);

  // Poll for new transactions and create notifications
  useEffect(() => {
    if (!user) return;

    const checkForNewTransactions = () => {
      const transactionsKey = `wallet_transactions_${user.id}`;
      const savedTransactions = localStorage.getItem(transactionsKey);
      const transactions = savedTransactions ? JSON.parse(savedTransactions) : [];
      
      const savedNotifications = localStorage.getItem(`${NOTIFICATIONS_KEY}_${user.id}`);
      const existingNotifications: Notification[] = savedNotifications ? JSON.parse(savedNotifications) : [];
      const existingIds = new Set(existingNotifications.map(n => n.id));

      // Check for received transactions that don't have notifications yet
      const newNotifications: Notification[] = [];
      transactions.forEach((tx: any) => {
        const notifId = `notif_${tx.id}`;
        if (tx.type === 'receive' && !existingIds.has(notifId)) {
          newNotifications.push({
            id: notifId,
            type: 'money_received',
            title: 'Money Received',
            message: `You received $${Math.abs(tx.amount).toFixed(2)} from ${tx.senderName || 'Unknown'}`,
            date: tx.date,
            read: false,
            amount: tx.amount,
            senderName: tx.senderName,
          });
        }
      });

      if (newNotifications.length > 0) {
        const allNotifications = [...newNotifications, ...existingNotifications];
        setNotifications(allNotifications);
        localStorage.setItem(`${NOTIFICATIONS_KEY}_${user.id}`, JSON.stringify(allNotifications));
      } else {
        setNotifications(existingNotifications);
      }
    };

    checkForNewTransactions();
    const interval = setInterval(checkForNewTransactions, 2000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const saveNotifications = (newNotifications: Notification[]) => {
    if (user) {
      localStorage.setItem(`${NOTIFICATIONS_KEY}_${user.id}`, JSON.stringify(newNotifications));
      setNotifications(newNotifications);
    }
  };

  const markAsRead = (id: string) => {
    saveNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    saveNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    saveNotifications(notifications.filter(n => n.id !== id));
  };

  const addNotification = (params: AddNotificationParams) => {
    const { targetUserId, ...rest } = params;
    
    // If targetUserId is specified and not current user, save to that user's notifications
    if (targetUserId && user && targetUserId !== user.id) {
      const targetNotificationsKey = `${NOTIFICATIONS_KEY}_${targetUserId}`;
      const savedNotifications = localStorage.getItem(targetNotificationsKey);
      const existingNotifications: Notification[] = savedNotifications ? JSON.parse(savedNotifications) : [];
      
      const newNotification: Notification = {
        id: crypto.randomUUID(),
        ...rest,
        date: new Date().toISOString(),
        read: false,
      };
      
      localStorage.setItem(targetNotificationsKey, JSON.stringify([newNotification, ...existingNotifications]));
    } else if (user) {
      // Add to current user's notifications
      const newNotification: Notification = {
        id: crypto.randomUUID(),
        ...rest,
        date: new Date().toISOString(),
        read: false,
      };
      saveNotifications([newNotification, ...notifications]);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
