import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Users, DollarSign, Clock, Check, X, Search, Shield, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useDeposits } from "@/contexts/DepositsContext";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/wallet/BottomNav";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const ITEMS_PER_PAGE = 5;

interface UserData { 
  email: string;
  name: string;
  balance: number;
  id: string;
  suspended?: boolean;
}

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const { allDeposits, approveDeposit, rejectDeposit } = useDeposits();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [depositsPage, setDepositsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [cryptoFilter, setCryptoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [pendingRecipients, setPendingRecipients] = useState<any[]>([]);
  
  // Helper function to get admin headers
  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-admin': 'admin'
  });
  
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users`, { 
          headers: getAdminHeaders()  // Fixed: Added admin headers
        });
        if (!res.ok) { 
          console.error('fetch users failed', res.status); 
          return; 
        }
        let data: any = null;
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            data = await res.json();
          } else {
            const text = await res.text();
            try { data = JSON.parse(text); } catch { console.error('non-json users response', text); return; }
          }
        } catch (e) { console.error('parse users response error', e); return; }
        const userList: UserData[] = (data.users || []).map((u: any) => ({
          email: u.email,
          name: u.name,
          balance: u.balance || 0,
          id: u._id || u.id,
          suspended: u.suspended ?? false,
        }));
        setUsers(userList);
      } catch (err) {
        console.error('fetch users error', err);
      }
    };
    fetchUsers();
  }, [allDeposits]);

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

  if (user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const pendingDeposits = allDeposits.filter(d => d.status === 'pending');
  const processedDeposits = allDeposits.filter(d => d.status !== 'pending');

  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
    const fetchPendingTransfers = async () => {
      try {
        const [res1, res2] = await Promise.all([
          fetch(`${API_BASE}/api/admin/pending`, { headers: getAdminHeaders() }),  // Fixed: Added admin headers
          fetch(`${API_BASE}/api/admin/pending-recipient`, { headers: getAdminHeaders() })  // Fixed: Added admin headers
        ]);
        if (res1.ok) {
          const data = await res1.json();
          setPendingTransfers(data.pendings || []);
        }
        if (res2.ok) {
          const data2 = await res2.json();
          setPendingRecipients(data2.pendingRecipients || []);
        }
      } catch (err) { console.error('fetch pending items error', err); }
    };
    fetchPendingTransfers();
  }, []);

  // Apply filters to deposits
  const filterDeposits = (deposits: typeof allDeposits) => {
    return deposits.filter(d => {
      if (cryptoFilter !== "all" && d.symbol !== cryptoFilter) return false;
      if (amountFilter === "low" && d.amount > 100) return false;
      if (amountFilter === "medium" && (d.amount <= 100 || d.amount > 1000)) return false;
      if (amountFilter === "high" && d.amount <= 1000) return false;
      return true;
    });
  };

  const filteredPendingDeposits = filterDeposits(pendingDeposits);
  const filteredProcessedDeposits = processedDeposits.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return filterDeposits([d]).length > 0;
  });

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination helpers
  const paginate = <T,>(items: T[], page: number) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  };

  const getTotalPages = (totalItems: number) => Math.ceil(totalItems / ITEMS_PER_PAGE);

  const paginatedUsers = paginate(filteredUsers, usersPage);
  const paginatedPendingDeposits = paginate(filteredPendingDeposits, depositsPage);
  const paginatedProcessedDeposits = paginate(filteredProcessedDeposits, historyPage);

  const handleApprove = (depositId: string) => {
    approveDeposit(depositId);
    toast({ title: "Deposit Approved", description: "User has been notified and balance updated." });
  };

  const handleReject = (depositId: string) => {
    rejectDeposit(depositId);
    toast({ title: "Deposit Rejected", description: "User has been notified.", variant: "destructive" });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);

  const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const cryptoOptions = [...new Set(allDeposits.map(d => d.symbol))];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-secondary">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage users & deposits</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Test Admin Access Button */}
            <button 
              onClick={async () => {
                try {
                  const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
                  const res = await fetch(`${API_BASE}/api/users`, {
                    headers: getAdminHeaders()
                  });
                  const data = await res.json();
                  console.log('Test response:', data);
                  toast({
                    title: res.ok ? "Admin Access OK" : "Admin Access Failed",
                    description: `Status: ${res.status}`,
                    variant: res.ok ? "default" : "destructive"
                  });
                } catch (err) {
                  console.error('Test failed:', err);
                  toast({ title: "Test Failed", description: "Network error", variant: "destructive" });
                }
              }}
              className="p-2 rounded-full hover:bg-secondary"
              title="Test Admin Access"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            
            {/* Refresh Users Button */}
            <button 
              onClick={async () => {
                try {
                  const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
                  const res = await fetch(`${API_BASE}/api/users`, { 
                    headers: getAdminHeaders()
                  });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const data = await res.json();
                  const userList: UserData[] = (data.users || []).map((u: any) => ({
                    email: u.email,
                    name: u.name,
                    balance: u.balance || 0,
                    id: u._id || u.id,
                    suspended: u.suspended ?? false,
                  }));
                  setUsers(userList);
                  toast({ 
                    title: "Users Refreshed", 
                    description: `Loaded ${userList.length} users` 
                  });
                } catch (err) {
                  console.error('Refresh failed:', err);
                  toast({ 
                    title: "Refresh Failed", 
                    description: "Could not fetch users", 
                    variant: "destructive" 
                  });
                }
              }}
              className="p-2 rounded-full hover:bg-secondary"
              title="Refresh Users"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <div className="p-2 rounded-full bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mb-2">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">{users.length}</p>
            <p className="text-xs text-muted-foreground">Users</p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 mb-2">
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-lg font-bold text-foreground">${totalBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 mb-2">
              <Clock className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{pendingDeposits.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        <Tabs defaultValue="deposits" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="deposits" className="text-xs">
              Pending ({filteredPendingDeposits.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              Users
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits" className="space-y-3">
            {/* Deposit Filters */}
            <div className="flex gap-2 mb-3">
              <Select value={cryptoFilter} onValueChange={setCryptoFilter}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Crypto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Crypto</SelectItem>
                  {cryptoOptions.map(crypto => (
                    <SelectItem key={crypto} value={crypto}>{crypto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={amountFilter} onValueChange={setAmountFilter}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Amount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Amounts</SelectItem>
                  <SelectItem value="low">$0 - $100</SelectItem>
                  <SelectItem value="medium">$100 - $1000</SelectItem>
                  <SelectItem value="high">$1000+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paginatedPendingDeposits.length === 0 && pendingTransfers.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pending items</p>
              </div>
            ) : (
              <>
                {paginatedPendingDeposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="p-4 rounded-2xl bg-card border border-border animate-fade-in"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{deposit.userName}</p>
                        <p className="text-xs text-muted-foreground">{deposit.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">${deposit.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{deposit.cryptoAmount} {deposit.symbol}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{formatDate(deposit.date)}</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(deposit.id)}
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 h-9"
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(deposit.id)}
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-9"
                      >
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Pending Transfers */}
                {pendingTransfers.map((t) => (
                  <div key={t._id} className="p-4 rounded-2xl bg-card border border-border animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{t.senderEmail} → {t.recipientEmail}</p>
                        <p className="text-xs text-muted-foreground">{t.message || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">${t.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{t.symbol || t.crypto}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{formatDate(t.createdAt)}</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          try {
                            const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
                            const res = await fetch(`${API_BASE}/api/admin/pending/${t._id}/approve`, { method: 'PUT', headers: getAdminHeaders() });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Transfer Approved', description: 'Transfer completed and balances updated.' });
                              setPendingTransfers(prev => prev.filter(p => p._id !== t._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to approve', variant: 'destructive' });
                            }
                          } catch (err) { console.error(err); toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
                        }}
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 h-9"
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
                            const res = await fetch(`${API_BASE}/api/admin/pending/${t._id}/cancel`, { method: 'PUT', headers: getAdminHeaders() });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Transfer Cancelled', description: 'Transfer has been cancelled.', variant: 'destructive' });
                              setPendingTransfers(prev => prev.filter(p => p._id !== t._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to cancel', variant: 'destructive' });
                            }
                          } catch (err) { console.error(err); toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
                        }}
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-9"
                      >
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Pending Recipients */}
                {pendingRecipients.map((r) => (
                  <div key={r._id} className="p-4 rounded-2xl bg-card border border-border animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{r.email}</p>
                        <p className="text-xs text-muted-foreground">{r.name || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">Status: {r.status}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{formatDate(r.createdAt)}</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          try {
                            const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
                            const res = await fetch(`${API_BASE}/api/admin/pending-recipient/${r._id}/approve`, { method: 'PUT', headers: getAdminHeaders() });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Recipient Approved', description: 'Recipient approved and user created.' });
                              setPendingRecipients(prev => prev.filter(p => p._id !== r._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to approve recipient', variant: 'destructive' });
                            }
                          } catch (err) { console.error(err); toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
                        }}
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 h-9"
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
                            const res = await fetch(`${API_BASE}/api/admin/pending-recipient/${r._id}/reject`, { method: 'PUT', headers: getAdminHeaders() });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Recipient Rejected', description: 'Recipient has been rejected.', variant: 'destructive' });
                              setPendingRecipients(prev => prev.filter(p => p._id !== r._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to reject', variant: 'destructive' });
                            }
                          } catch (err) { console.error(err); toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
                        }}
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-9"
                      >
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
            <PaginationControls
              currentPage={depositsPage}
              totalPages={getTotalPages(filteredPendingDeposits.length)}
              onPageChange={setDepositsPage}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setUsersPage(1); }}
                className="pl-10 h-10"
              />
            </div>
            <div className="space-y-2">
              {paginatedUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-2xl bg-card border border-border animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">${u.balance.toLocaleString()}</p>
                      <div className="mt-2 flex items-center gap-2 justify-end">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.suspended ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                          {u.suspended ? 'Suspended' : 'Active'}
                        </span>
                        <Button
                          variant={u.suspended ? "default" : "destructive"}
                          size="sm"
                          className="h-8"
                          onClick={async () => {
                            try {
                              const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
                              const res = await fetch(`${API_BASE}/api/admin/users/${u.id}/suspend`, {
                                method: 'PUT',
                                headers: getAdminHeaders(),
                                body: JSON.stringify({ suspended: !u.suspended })
                              });
                              let data: any = null;
                              try {
                                const ct = res.headers.get('content-type') || '';
                                if (ct.includes('application/json')) {
                                  data = await res.json();
                                } else {
                                  const text = await res.text();
                                  try { data = JSON.parse(text); } catch { data = { error: text }; }
                                }
                              } catch {
                                data = { error: 'Invalid response format' };
                              }
                              if (res.ok && data && data.user) {
                                setUsers(prev => prev.map(us => us.id === u.id ? { ...us, suspended: data.user?.suspended ?? !u.suspended } : us));
                                toast({
                                  title: u.suspended ? 'User Unsuspended' : 'User Suspended',
                                  description: u.suspended ? 'User can access the account.' : 'User access is blocked.'
                                });
                              } else {
                                const message = (data && data.error) ? data.error : `Request failed (${res.status})`;
                                toast({ title: 'Error', description: message, variant: 'destructive' });
                              }
                            } catch (err) {
                              console.error('suspend toggle error', err);
                              toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
                            }
                          }}
                        >
                          {u.suspended ? 'Unsuspend' : 'Suspend'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls
              currentPage={usersPage}
              totalPages={getTotalPages(filteredUsers.length)}
              onPageChange={setUsersPage}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {/* History Filters */}
            <div className="flex gap-2 mb-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cryptoFilter} onValueChange={setCryptoFilter}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Crypto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Crypto</SelectItem>
                  {cryptoOptions.map(crypto => (
                    <SelectItem key={crypto} value={crypto}>{crypto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {paginatedProcessedDeposits.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No processed deposits yet</p>
              </div>
            ) : (
              paginatedProcessedDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="p-3 rounded-2xl bg-card border border-border animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{deposit.userName}</p>
                      <p className="text-xs text-muted-foreground">{deposit.userEmail}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(deposit.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">${deposit.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{deposit.cryptoAmount} {deposit.symbol}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        deposit.status === 'approved' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                      }`}>
                        {deposit.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
            <PaginationControls
              currentPage={historyPage}
              totalPages={getTotalPages(filteredProcessedDeposits.length)}
              onPageChange={setHistoryPage}
            />
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default AdminPage;
