import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Users, DollarSign, Clock, Check, X, Search, Shield, ChevronLeft, ChevronRight, Filter, RefreshCw, AlertCircle, UserPlus, UserMinus } from "lucide-react";
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
  status?: string;
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
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
 
  // Helper function to get headers
  const getHeaders = (needsUserAuth = false) => {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-admin': 'admin' // Always send admin header
    };
    
    // Get user token from localStorage (common place to store it)
    if (needsUserAuth) {
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('authToken') ||
                    sessionStorage.getItem('token');
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('No user token found for authenticated endpoint');
      }
    }
    
    return headers;
  };

  // Fetch ALL users
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
    
    const fetchAllUsers = async () => {
      setIsLoadingUsers(true);
      try {
        console.log("🔍 Fetching users from:", `${API_BASE}/api/users`);
        
        // Try with admin header only first
        const res = await fetch(`${API_BASE}/api/users`, { 
          headers: getHeaders(false) // false = admin header only
        });
        
        console.log("📊 Users API status:", res.status);
        
        // If 403, try with user auth too
        if (res.status === 403 || res.status === 401) {
          console.log("🔄 Trying with user authentication...");
          const resWithAuth = await fetch(`${API_BASE}/api/users`, { 
            headers: getHeaders(true) // true = admin + user auth
          });
          
          if (resWithAuth.ok) {
            const data = await resWithAuth.json();
            processUserData(data);
          } else {
            throw new Error(`Failed to fetch users: ${resWithAuth.status}`);
          }
        } else if (res.ok) {
          const data = await res.json();
          processUserData(data);
        } else {
          throw new Error(`Failed to fetch users: ${res.status}`);
        }
        
      } catch (err) {
        console.error('fetch users error', err);
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive"
        });
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    const processUserData = (data: any) => {
      console.log("📊 Users API response:", data);
      
      let userList: UserData[] = [];
      let pendingUserList: UserData[] = [];
      
      if (Array.isArray(data.users)) {
        data.users.forEach((u: any) => {
          const userObj: UserData = {
            email: u.email || u.userEmail || '',
            name: u.name || u.username || 'Unknown User',
            balance: u.balance || u.amount || 0,
            id: u._id || u.id || Math.random().toString(),
            suspended: u.suspended || false,
            status: u.status || 'approved'
          };
          
          if (u.status === 'pending' || u.approved === false || u.isPending === true) {
            pendingUserList.push(userObj);
          } else {
            userList.push(userObj);
          }
        });
      } else if (Array.isArray(data)) {
        data.forEach((u: any) => {
          const userObj: UserData = {
            email: u.email || '',
            name: u.name || 'Unknown',
            balance: u.balance || 0,
            id: u._id || u.id || '',
            suspended: u.suspended || false,
            status: u.status || 'approved'
          };
          
          if (u.status === 'pending') {
            pendingUserList.push(userObj);
          } else {
            userList.push(userObj);
          }
        });
      }
      
      console.log(`✅ Approved users: ${userList.length}, Pending users: ${pendingUserList.length}`);
      setUsers(userList);
      setPendingUsers(pendingUserList);
    };
    
    fetchAllUsers();
  }, []);

  // Also fetch from specific pending users endpoint
  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
        
        // Try common pending user endpoints
        const endpoints = [
          '/api/admin/pending-users',
          '/api/users/pending',
          '/api/pending-users',
          '/api/admin/pendingUsers'
        ];
        
        for (const endpoint of endpoints) {
          try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
              headers: getHeaders(false)
            });
            
            if (res.ok) {
              const data = await res.json();
              console.log(`✅ Found pending users at ${endpoint}:`, data);
              
              if (Array.isArray(data.users) || Array.isArray(data.pendingUsers) || Array.isArray(data)) {
                const usersArray = Array.isArray(data.users) ? data.users : 
                                 Array.isArray(data.pendingUsers) ? data.pendingUsers : 
                                 data;
                
                const newPendingUsers = usersArray.map((u: any) => ({
                  email: u.email || '',
                  name: u.name || 'Unknown',
                  balance: 0,
                  id: u._id || u.id || '',
                  suspended: false,
                  status: 'pending'
                }));
                
                setPendingUsers(prev => {
                  // Avoid duplicates
                  const existingIds = new Set(prev.map(u => u.id));
                  const uniqueNewUsers = newPendingUsers.filter((u: UserData) => !existingIds.has(u.id));
                  return [...prev, ...uniqueNewUsers];
                });
                
                toast({
                  title: "Pending Users Found",
                  description: `Found ${newPendingUsers.length} pending users`
                });
                
                break;
              }
            }
          } catch (err) {
            console.log(`Endpoint ${endpoint} not available or error:`, err);
          }
        }
      } catch (err) {
        console.error('Error fetching pending users:', err);
      }
    };
    
    fetchPendingUsers();
  }, []);

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

  // Fetch pending transfers and recipients
  useEffect(() => {
    const fetchPendingItems = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
        const [res1, res2] = await Promise.all([
          fetch(`${API_BASE}/api/admin/pending`, { headers: getHeaders(false) }),
          fetch(`${API_BASE}/api/admin/pending-recipient`, { headers: getHeaders(false) })
        ]);
        
        if (res1.ok) {
          const data = await res1.json();
          setPendingTransfers(data.pendings || []);
          console.log("Pending transfers:", data.pendings);
        } else {
          console.warn("Failed to fetch pending transfers:", res1.status);
        }
        
        if (res2.ok) {
          const data2 = await res2.json();
          setPendingRecipients(data2.pendingRecipients || []);
          console.log("Pending recipients:", data2.pendingRecipients);
        } else {
          console.warn("Failed to fetch pending recipients:", res2.status);
        }
      } catch (err) { 
        console.error('fetch pending items error', err); 
      }
    };
    
    fetchPendingItems();
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
  const paginatedPendingUsers = paginate(pendingUsers, 1);

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

  // Handle user suspension/unsuspension
  const handleSuspendUser = async (userId: string, currentSuspended: boolean) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: getHeaders(true), // Needs both admin and user auth
        body: JSON.stringify({ suspended: !currentSuspended })
      });
      
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = { error: 'Invalid response format' };
      }
      
      if (res.ok && (data.user || data.success)) {
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, suspended: !currentSuspended } : u
        ));
        toast({
          title: currentSuspended ? 'User Unsuspended' : 'User Suspended',
          description: currentSuspended ? 'User can access the account.' : 'User access is blocked.'
        });
      } else {
        const message = data?.error || `Request failed (${res.status})`;
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } catch (err) {
      console.error('suspend toggle error', err);
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  // Handle pending user approval/rejection
  const handleApproveUser = async (pendingUserId: string, userEmail: string) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/admin/users/${pendingUserId}/approve`, {
        method: 'PUT',
        headers: getHeaders(true),
        body: JSON.stringify({ approved: true })
      });
      
      if (res.ok) {
        const pendingUser = pendingUsers.find(u => u.id === pendingUserId);
        if (pendingUser) {
          setPendingUsers(prev => prev.filter(u => u.id !== pendingUserId));
          setUsers(prev => [...prev, { ...pendingUser, suspended: false }]);
        }
        toast({ title: "User Approved", description: `${userEmail} can now access the platform.` });
      } else {
        const errorText = await res.text();
        toast({ title: 'Error', description: `Failed to approve user: ${errorText}`, variant: 'destructive' });
      }
    } catch (err) {
      console.error('approve user error', err);
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  const handleRejectUser = async (pendingUserId: string, userEmail: string) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/admin/users/${pendingUserId}/reject`, {
        method: 'DELETE',
        headers: getHeaders(true)
      });
      
      if (res.ok) {
        setPendingUsers(prev => prev.filter(u => u.id !== pendingUserId));
        toast({ title: "User Rejected", description: `${userEmail} has been rejected.`, variant: "destructive" });
      } else {
        const errorText = await res.text();
        toast({ title: 'Error', description: `Failed to reject user: ${errorText}`, variant: 'destructive' });
      }
    } catch (err) {
      console.error('reject user error', err);
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

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
            <button 
              onClick={() => window.location.reload()}
              className="p-2 rounded-full hover:bg-secondary"
              title="Refresh All"
            >
              <RefreshCw className="w-5 h-5 text-foreground" />
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
            <p className="text-xs text-muted-foreground">Active Users</p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 mb-2">
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-lg font-bold text-foreground">${totalBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Balance</p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 mb-2">
              <UserPlus className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{pendingUsers.length}</p>
            <p className="text-xs text-muted-foreground">Pending Users</p>
          </div>
        </div>

        <Tabs defaultValue="pending-users" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="pending-users" className="text-xs">
              Pending Users ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="deposits" className="text-xs">
              Pending Deposits ({filteredPendingDeposits.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              Active Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>

          {/* PENDING USERS TAB */}
          <TabsContent value="pending-users" className="space-y-3">
            {isLoadingUsers ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading pending users...</p>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pending user registrations</p>
                <p className="text-xs text-muted-foreground mt-1">New user signups will appear here for approval</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div key={pendingUser.id} className="p-4 rounded-2xl bg-card border border-yellow-500/30 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{pendingUser.name}</p>
                          <p className="text-xs text-muted-foreground">{pendingUser.email}</p>
                          <p className="text-xs text-yellow-500 mt-1">Awaiting Approval</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => handleApproveUser(pendingUser.id, pendingUser.email)}
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 h-9"
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve User
                      </Button>
                      <Button
                        onClick={() => handleRejectUser(pendingUser.id, pendingUser.email)}
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-9"
                      >
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DEPOSITS TAB */}
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

            {paginatedPendingDeposits.length === 0 && pendingTransfers.length === 0 && pendingRecipients.length === 0 ? (
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
                            const res = await fetch(`${API_BASE}/api/admin/pending/${t._id}/approve`, { 
                              method: 'PUT', 
                              headers: getHeaders(true) 
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Transfer Approved', description: 'Transfer completed and balances updated.' });
                              setPendingTransfers(prev => prev.filter(p => p._id !== t._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to approve', variant: 'destructive' });
                            }
                          } catch (err) { 
                            console.error(err); 
                            toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); 
                          }
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
                            const res = await fetch(`${API_BASE}/api/admin/pending/${t._id}/cancel`, { 
                              method: 'PUT', 
                              headers: getHeaders(true) 
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Transfer Cancelled', description: 'Transfer has been cancelled.', variant: 'destructive' });
                              setPendingTransfers(prev => prev.filter(p => p._id !== t._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to cancel', variant: 'destructive' });
                            }
                          } catch (err) { 
                            console.error(err); 
                            toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); 
                          }
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
                            const res = await fetch(`${API_BASE}/api/admin/pending-recipient/${r._id}/approve`, { 
                              method: 'PUT', 
                              headers: getHeaders(true) 
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Recipient Approved', description: 'Recipient approved and user created.' });
                              setPendingRecipients(prev => prev.filter(p => p._id !== r._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to approve recipient', variant: 'destructive' });
                            }
                          } catch (err) { 
                            console.error(err); 
                            toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); 
                          }
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
                            const res = await fetch(`${API_BASE}/api/admin/pending-recipient/${r._id}/reject`, { 
                              method: 'PUT', 
                              headers: getHeaders(true) 
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: 'Recipient Rejected', description: 'Recipient has been rejected.', variant: 'destructive' });
                              setPendingRecipients(prev => prev.filter(p => p._id !== r._id));
                            } else {
                              toast({ title: 'Error', description: data.error || 'Failed to reject', variant: 'destructive' });
                            }
                          } catch (err) { 
                            console.error(err); 
                            toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); 
                          }
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

          {/* ACTIVE USERS TAB */}
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
            
            {isLoadingUsers ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No active users found</p>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : (
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
                          <p className="text-xs text-muted-foreground mt-1">
                            Balance: ${u.balance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${u.suspended ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                          {u.suspended ? 'Suspended' : 'Active'}
                        </span>
                        <Button
                          variant={u.suspended ? "default" : "destructive"}
                          size="sm"
                          className="h-8 min-w-[90px]"
                          onClick={() => handleSuspendUser(u.id, u.suspended || false)}
                        >
                          {u.suspended ? (
                            <>
                              <UserMinus className="w-3 h-3 mr-1" />
                              Unsuspend
                            </>
                          ) : (
                            <>
                              <UserMinus className="w-3 h-3 mr-1" />
                              Suspend
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
