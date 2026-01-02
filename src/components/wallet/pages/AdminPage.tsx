import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Users, DollarSign, Clock, Check, X, Search, Shield, ChevronLeft, ChevronRight, Filter, RefreshCw, AlertCircle, UserPlus, UserMinus, Mail } from "lucide-react";
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

interface PendingRecipient {
  _id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  userId?: string;
  userEmail?: string;
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
  const [pendingRecipients, setPendingRecipients] = useState<PendingRecipient[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState("deposits");
 
  // Helper function to get headers
  const getHeaders = (needsUserAuth = false) => {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-admin': 'admin'
    };
    
    if (needsUserAuth) {
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('authToken') ||
                    sessionStorage.getItem('token');
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
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
        const res = await fetch(`${API_BASE}/api/users`, { 
          headers: getHeaders(false)
        });
        
        if (res.ok) {
          const data = await res.json();
          processUserData(data);
        } else if (res.status === 403 || res.status === 401) {
          const resWithAuth = await fetch(`${API_BASE}/api/users`, { 
            headers: getHeaders(true)
          });
          
          if (resWithAuth.ok) {
            const data = await resWithAuth.json();
            processUserData(data);
          }
        }
        
      } catch (err) {
        console.error('fetch users error', err);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    const processUserData = (data: any) => {
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
      }
      
      setUsers(userList);
      setPendingUsers(pendingUserList);
    };
    
    fetchAllUsers();
  }, []);

  // Fetch pending recipients - FIXED THIS FUNCTION
  useEffect(() => {
    const fetchPendingRecipients = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
        
        console.log("🔄 Fetching pending recipients...");
        
        // Try different endpoints for pending recipients
        const endpoints = [
          '/api/admin/pending-recipient',
          '/api/admin/pending-recipients',
          '/api/pending-recipients',
          '/api/pending/recipients',
          '/api/recipients/pending'
        ];
        
        for (const endpoint of endpoints) {
          try {
            console.log(`🔍 Trying endpoint: ${endpoint}`);
            const res = await fetch(`${API_BASE}${endpoint}`, {
              headers: getHeaders(false)
            });
            
            console.log(`📊 Response status for ${endpoint}:`, res.status);
            
            if (res.ok) {
              const data = await res.json();
              console.log(`✅ Found pending recipients at ${endpoint}:`, data);
              
              // Handle different response structures
              let recipientsArray: any[] = [];
              
              if (Array.isArray(data.pendingRecipients)) {
                recipientsArray = data.pendingRecipients;
              } else if (Array.isArray(data.recipients)) {
                recipientsArray = data.recipients;
              } else if (Array.isArray(data)) {
                recipientsArray = data;
              } else if (data.data && Array.isArray(data.data)) {
                recipientsArray = data.data;
              }
              
              const formattedRecipients: PendingRecipient[] = recipientsArray.map((r: any) => ({
                _id: r._id || r.id || Math.random().toString(),
                email: r.email || r.userEmail || r.recipientEmail || 'Unknown',
                name: r.name || r.userName || r.recipientName || 'Unknown User',
                status: r.status || 'pending',
                createdAt: r.createdAt || r.date || new Date().toISOString(),
                userId: r.userId || r.user_id,
                userEmail: r.userEmail
              }));
              
              console.log(`✅ Formatted ${formattedRecipients.length} pending recipients`);
              setPendingRecipients(formattedRecipients);
              
              if (formattedRecipients.length > 0) {
                toast({
                  title: "Pending Recipients Loaded",
                  description: `Found ${formattedRecipients.length} pending recipients`
                });
              }
              
              break; // Stop trying other endpoints if this one worked
            }
          } catch (err) {
            console.log(`❌ Endpoint ${endpoint} failed:`, err);
          }
        }
      } catch (err) {
        console.error('❌ Error fetching pending recipients:', err);
      }
    };
    
    fetchPendingRecipients();
  }, []);

  // Fetch pending transfers
  useEffect(() => {
    const fetchPendingTransfers = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
        
        console.log("🔄 Fetching pending transfers...");
        const res = await fetch(`${API_BASE}/api/admin/pending`, {
          headers: getHeaders(false)
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Pending transfers data:", data);
          setPendingTransfers(data.pendings || data.transfers || []);
        } else {
          console.warn("Failed to fetch pending transfers:", res.status);
        }
      } catch (err) {
        console.error('fetch pending transfers error', err);
      }
    };
    
    fetchPendingTransfers();
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

  // Rest of your existing code for filters, pagination, etc.
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
        headers: getHeaders(true),
        body: JSON.stringify({ suspended: !currentSuspended })
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, suspended: !currentSuspended } : u
        ));
        toast({
          title: currentSuspended ? 'User Unsuspended' : 'User Suspended',
          description: currentSuspended ? 'User can access the account.' : 'User access is blocked.'
        });
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
      }
    } catch (err) {
      console.error('reject user error', err);
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  // Handle pending recipient approval
  const handleApproveRecipient = async (recipientId: string, email: string) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/admin/pending-recipient/${recipientId}/approve`, {
        method: 'PUT',
        headers: getHeaders(true)
      });
      
      if (res.ok) {
        setPendingRecipients(prev => prev.filter(r => r._id !== recipientId));
        toast({ 
          title: 'Recipient Approved', 
          description: `${email} has been approved as a recipient.` 
        });
      } else {
        const error = await res.text();
        toast({ 
          title: 'Error', 
          description: `Failed to approve: ${error}`, 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('approve recipient error', err);
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  // Handle pending recipient rejection
  const handleRejectRecipient = async (recipientId: string, email: string) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/admin/pending-recipient/${recipientId}/reject`, {
        method: 'PUT',
        headers: getHeaders(true)
      });
      
      if (res.ok) {
        setPendingRecipients(prev => prev.filter(r => r._id !== recipientId));
        toast({ 
          title: 'Recipient Rejected', 
          description: `${email} has been rejected as a recipient.`,
          variant: 'destructive' 
        });
      } else {
        const error = await res.text();
        toast({ 
          title: 'Error', 
          description: `Failed to reject: ${error}`, 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('reject recipient error', err);
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

  // Calculate total pending items for the deposits tab
  const totalPendingItems = filteredPendingDeposits.length + pendingTransfers.length + pendingRecipients.length;

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

        {/* Stats Cards - Added pending recipients count */}
        <div className="grid grid-cols-4 gap-3 mb-6">
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
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 mb-2">
              <Mail className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{pendingRecipients.length}</p>
            <p className="text-xs text-muted-foreground">Pending Recipients</p>
          </div>
        </div>

        <Tabs defaultValue="deposits" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="deposits" className="text-xs">
              Pending Items ({totalPendingItems})
            </TabsTrigger>
            <TabsTrigger value="pending-users" className="text-xs">
              Pending Users ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              Active Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>

          {/* DEPOSITS TAB - Now includes all pending items */}
          <TabsContent value="deposits" className="space-y-4">
            {/* Tabs within deposits for different types of pending items */}
            <div className="flex border-b border-border mb-4">
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'deposits' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                onClick={() => setActiveTab('deposits')}
              >
                Deposits ({filteredPendingDeposits.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'transfers' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                onClick={() => setActiveTab('transfers')}
              >
                Transfers ({pendingTransfers.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'recipients' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                onClick={() => setActiveTab('recipients')}
              >
                Recipients ({pendingRecipients.length})
              </button>
            </div>

            {/* Deposit Filters - Only show for deposits */}
            {activeTab === 'deposits' && (
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
            )}

            {/* PENDING DEPOSITS */}
            {activeTab === 'deposits' && (
              <>
                {filteredPendingDeposits.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-2xl border border-border">
                    <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No pending deposits</p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                    <PaginationControls
                      currentPage={depositsPage}
                      totalPages={getTotalPages(filteredPendingDeposits.length)}
                      onPageChange={setDepositsPage}
                    />
                  </div>
                )}
              </>
            )}

            {/* PENDING TRANSFERS */}
            {activeTab === 'transfers' && (
              <>
                {pendingTransfers.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-2xl border border-border">
                    <RefreshCw className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No pending transfers</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTransfers.map((t) => (
                      <div key={t._id} className="p-4 rounded-2xl bg-card border border-border animate-fade-in">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-foreground text-sm">{t.senderEmail} → {t.recipientEmail}</p>
                            <p className="text-xs text-muted-foreground">{t.message || ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-foreground">${t.amount?.toLocaleString() || '0'}</p>
                            <p className="text-xs text-muted-foreground">{t.symbol || t.crypto || ''}</p>
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
                  </div>
                )}
              </>
            )}

            {/* PENDING RECIPIENTS - FIXED DISPLAY */}
            {activeTab === 'recipients' && (
              <>
                {pendingRecipients.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-2xl border border-border">
                    <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No pending recipients</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Users who have requested to add recipients will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRecipients.map((recipient) => (
                      <div key={recipient._id} className="p-4 rounded-2xl bg-card border border-blue-500/30 animate-fade-in">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <Mail className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{recipient.name}</p>
                              <p className="text-xs text-muted-foreground">{recipient.email}</p>
                              {recipient.userEmail && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Requested by: {recipient.userEmail}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-blue-500 font-medium">Status: {recipient.status}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(recipient.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-4">
                          <Button
                            onClick={() => handleApproveRecipient(recipient._id, recipient.email)}
                            size="sm"
                            className="flex-1 bg-green-500 hover:bg-green-600 h-9"
                          >
                            <Check className="w-4 h-4 mr-1" /> Approve Recipient
                          </Button>
                          <Button
                            onClick={() => handleRejectRecipient(recipient._id, recipient.email)}
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
              </>
            )}
          </TabsContent>

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
                <PaginationControls
                  currentPage={usersPage}
                  totalPages={getTotalPages(filteredUsers.length)}
                  onPageChange={setUsersPage}
                />
              </div>
            )}
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-3">
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
              <>
                {paginatedProcessedDeposits.map((deposit) => (
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
                ))}
                <PaginationControls
                  currentPage={historyPage}
                  totalPages={getTotalPages(filteredProcessedDeposits.length)}
                  onPageChange={setHistoryPage}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default AdminPage;
