import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  recipientId?: string;
  recipientName?: string;
  senderId?: string;
  senderName?: string;
  date: string;
  status: 'completed' | 'pending';
  crypto?: string;
  symbol?: string;
}

export interface Card {
  id: string;
  type: 'Visa' | 'Mastercard';
  lastFour: string;
  holderName: string;
  expiryDate: string;
  color: string;
}

interface WalletContextType {
  transactions: Transaction[];
  cards: Card[];
  sendMoney: (recipientType: 'email' | 'crypto' | 'bank', recipientInput: string, recipientDetails: Record<string, any> | undefined, amount: number, cryptoId?: string, cryptoSymbol?: string, paymentMethod?: 'balance' | 'card', cardId?: string) => Promise<{ success: boolean; message: string; pendingId?: string }>;
  addCard: (card: Omit<Card, 'id'>) => void;
  removeCard: (cardId: string) => void;
  getRecentContacts: () => { id: string; name: string; email: string }[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const TRANSACTIONS_KEY = 'wallet_transactions';
const CARDS_KEY = 'wallet_cards';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, updateBalance } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, any>>({});

  // Helper to safely parse JSON responses that may be empty or not valid JSON
  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('[wallet] parseJsonSafe non-json response', text);
      return { _rawText: text };
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      // Fetch transactions from server
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/api/transactions?userId=${user.id}`);
        const data = await parseJsonSafe(res);
        if (res.ok) {
          setTransactions((data && data.transactions) ? data.transactions : []);
        } else {
          console.warn('[wallet] failed to fetch transactions', data || res.statusText);
        }
      } catch (err) {
        console.error('[wallet] fetch transactions error', err);
      }

      // Load cards from localStorage (cards are still client-side)
      const savedCards = localStorage.getItem(`${CARDS_KEY}_${user.id}`);
      if (savedCards) setCards(JSON.parse(savedCards));

      // Cache users for recent contacts discovery
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/api/users`);
        const data = await parseJsonSafe(res);
        const usersArray = (data && data.users) ? data.users : data;
        if (res.ok && Array.isArray(usersArray)) {
          const map: Record<string, any> = {};
          usersArray.forEach((u: any) => { if (u.email) map[u.email] = { user: u }; });
          setUsersCache(map);
        } else {
          console.warn('[wallet] failed to fetch users', data || res.statusText);
        }
      } catch (err) {
        console.error('[wallet] fetch users error', err);
      }
    };

    load();
  }, [user]);

  const saveTransactions = (newTransactions: Transaction[]) => {
    // Persisting transactions is handled by the server (for send/receive).
    // Locally just update state so UI stays responsive.
    setTransactions(newTransactions);
  };

  const saveCards = (newCards: Card[]) => {
    if (user) {
      localStorage.setItem(`${CARDS_KEY}_${user.id}`, JSON.stringify(newCards));
      setCards(newCards);
    }
  };

  const sendMoney = async (recipientType: 'email' | 'crypto' | 'bank', recipientInput: string, recipientDetails: Record<string, any> | undefined, amount: number, cryptoId?: string, cryptoSymbol?: string, paymentMethod?: 'balance' | 'card', cardId?: string): Promise<{ success: boolean; message: string, pendingId?: string }> => {
    if (!user) return { success: false, message: 'Not authenticated' };
    if (amount <= 0) return { success: false, message: 'Invalid amount' };
    // Only enforce wallet balance check when paying from balance
    if (paymentMethod !== 'card' && amount > user.balance) return { success: false, message: 'Insufficient balance' };

    // If using card, verify card exists
    if (paymentMethod === 'card') {
      if (!cardId) return { success: false, message: 'No card selected' };
      const found = cards.find(c => c.id === cardId);
      if (!found) return { success: false, message: 'Selected card not found' };
    }

    const base = import.meta.env.VITE_API_URL || '';

    // Normalize and validate per type
    let recipientEmail = '';
    const normalizedInput = String(recipientInput || '').trim();

    if (recipientType === 'email') {
      recipientEmail = normalizedInput.toLowerCase();
      if (!recipientEmail || !recipientEmail.includes('@')) return { success: false, message: 'Invalid recipient email' };
      if (recipientEmail === user.email) return { success: false, message: 'Cannot send money to yourself' };
    } else if (recipientType === 'crypto') {
      if (!normalizedInput) return { success: false, message: 'Invalid wallet address' };
      if (!cryptoId) return { success: false, message: 'Please select a cryptocurrency' };
    } else if (recipientType === 'bank') {
      const details = recipientDetails || {};
      // Accept accountNumber, accountName or username
      if (!details.accountNumber && !details.username && !details.accountName) return { success: false, message: 'Please provide bank account number or account name/username' };
    }

    try {
      const rd = recipientType === 'crypto' ? { address: normalizedInput } : (recipientDetails || (recipientType === 'bank' ? { accountNumber: normalizedInput } : {}));
      const payload: any = {
        senderId: user.id,
        recipientType,
        recipientEmail: recipientEmail || undefined,
        recipientDetails: rd,
        amount,
        crypto: cryptoId || '',
        symbol: cryptoSymbol || '',
        paymentMethod: paymentMethod || 'balance',
        cardId: cardId || ''
      };

      // Safeguard: also include bank fields at top-level for compatibility with server normalization
      if (recipientType === 'bank' && rd) {
        if (rd.accountNumber) payload.accountNumber = rd.accountNumber;
        if (rd.accountName) payload.accountName = rd.accountName;
        if (rd.bankName) payload.bankName = rd.bankName;
        if (rd.username) payload.username = rd.username;
      }

      // debug: log payload
      console.debug('[wallet] sendMoney payload:', JSON.stringify(payload, null, 2));

      const res = await fetch(`${base}/api/transactions/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonSafe(res);
      if (!res.ok) {
        // Log server response for debugging (stringify for readability)
        try {
          console.error('[wallet] sendMoney failed status', res.status, 'body:', JSON.stringify(data, null, 2));
        } catch (e) {
          console.error('[wallet] sendMoney failed status', res.status, 'body(raw):', data);
        }
        let msg = (data && (data.error || data._rawText)) || res.statusText || 'Failed to send';
        if (data && data.received) {
          msg = `${msg} — received: ${JSON.stringify(data.received)}`;
        }
        // Also show server body if available
        if (!msg && data) msg = JSON.stringify(data);
        return { success: false, message: msg };
      }

      // If server returned pending
      if (data && data.status === 'pending') {
        // Optionally add pending to local state or notify user
        return { success: true, message: 'Transfer created as pending (awaiting admin approval)', pendingId: data.pending?._id };
      }

      // Prepend the sender's transaction to local state
      if (data && data.senderTx) setTransactions(prev => [data.senderTx, ...prev]);
      else {
        // fallback: re-fetch transactions
        try {
          const txRes = await fetch(`${base}/api/transactions?userId=${user.id}`);
          const txData = await parseJsonSafe(txRes);
          if (txRes.ok) setTransactions((txData && txData.transactions) ? txData.transactions : []);
        } catch (e) { console.error('[wallet] fallback fetch tx error', e); }
      }

      // Update client-side balance using server's value
      if (data.sender && typeof data.sender.balance === 'number') {
        updateBalance(data.sender.balance);
      }

      return { success: true, message: 'Money sent successfully' };
    } catch (err: any) {
      console.error('[wallet] sendMoney error', err);
      return { success: false, message: err?.message || JSON.stringify(err) || 'Network error' };
    }
  };

  const addCard = (card: Omit<Card, 'id'>) => {
    const newCard: Card = {
      ...card,
      id: crypto.randomUUID(),
    };
    saveCards([...cards, newCard]);
  };

  const removeCard = (cardId: string) => {
    saveCards(cards.filter(c => c.id !== cardId));
  };

  const getRecentContacts = () => {
    // Use cached server users (loaded on user change)
    const users = usersCache || {};

    // Get unique recipients from transactions
    const sentTo = new Set<string>();
    transactions.forEach(t => {
      if (t.type === 'send' && t.recipientId) {
        sentTo.add(t.recipientId);
      }
    });

    // Map to user details
    const contacts: { id: string; name: string; email: string }[] = [];
    Object.entries(users).forEach(([email, data]: [string, any]) => {
      if (data?.user && sentTo.has(data.user.id) && email !== user?.email) {
        contacts.push({ id: data.user.id, name: data.user.name, email });
      }
    });

    return contacts;
  };

  return (
    <WalletContext.Provider value={{ transactions, cards, sendMoney, addCard, removeCard, getRecentContacts }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
