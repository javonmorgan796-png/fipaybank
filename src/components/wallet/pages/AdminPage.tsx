import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Users, DollarSign, Clock, Check, X, Search, Shield, ChevronLeft, ChevronRight, Filter, RefreshCw, AlertCircle, CreditCard, FileText, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/wallet/BottomNav";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";
const ITEMS_PER_PAGE = 10;

interface UserData { 
  email: string;
  name: string;
  balance: number;
  id: string;
  suspended?: boolean;
  role?: string;
  createdAt?: string;
}

interface DepositData {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  crypto: string;
  symbol: string;
  amount: number;
  status: string;
  createdAt: string;
  cryptoAmount?: string;
  address?: string;
}

interface PendingTransactionData {
  _id: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  recipientType: string;
  amount: number;
  status: string;
  createdAt: string;
  message?: string;
}

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<DepositData[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransactionData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Helper function to get admin headers
  const getAdminHeaders = () => {
    if (!user?.id) return {};
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-user-id': user.id,
      'x-admin': 'true'
    };
  };
  
  // Function to fetch all admin data
  const fetchAdminData = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please login as admin",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoadingAll(true);
    setErrorMessage(null);
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const headers = getAdminHeaders();
      
      console.log('🔄 [ADMIN] Fetching admin data...');
      
      // Fetch all users
      const usersResponse = await fetch(`${API_BASE}/api/admin/users`, { 
        headers 
      });
      
      if (!usersResponse.ok) {
        throw new Error(`Failed to fetch users: ${usersResponse.status}`);
      }
      
      const usersData = await usersResponse.json();
      const userList: UserData[] = usersData.users?.map((u: any) => ({
        email: u.email || 'No email',
        name: u.name || 'No name',
        balance: Number(u.balance) || 0,
        id: u._id || u.id,
        suspended: u.suspended || false,
        role: u.role || 'user',
        createdAt: u.createdAt
      })) || [];
      
      setUsers(userList);
      
      // Fetch pending deposits
      const depositsResponse = await fetch(`${API_BASE}/api/admin/deposits?status=pending`, { 
        headers 
      });
      
      if (depositsResponse.ok) {
        const depositsData = await depositsResponse.json();
        setPendingDeposits(depositsData.deposits || []);
      }
      
      // Fetch pending transactions
      const transactionsResponse = await fetch(`${API_BASE}/api/admin/pending-transactions`, { 
        headers 
      });
      
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setPendingTransactions(transactionsData.transactions || []);
      }
      
      console.log(`✅ [ADMIN] Loaded: ${userList.length} users, ${pendingDeposits.length} pending deposits, ${pendingTransactions.length} pending transactions`);
      
      toast({
        title: "Admin Data Loaded",
        description: `Loaded ${userList.length} users, ${pendingDeposits.length} pending deposits`
      });
      
    } catch (error: any) {
      console.error('❌ [ADMIN] Fetch error:', error);
      setErrorMessage(`Error: ${error.message}`);
      toast({
        title: "Failed to Load Admin Data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingAll(false);
    }
  };
  
  // Function to approve deposit
  const approveDeposit = async (depositId: string) => {
    if (!user?.id) return;
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const headers = getAdminHeaders();
      
      const response = await fetch(`${API_BASE}/api/deposits/${depositId}/approve`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notes: 'Approved by admin' })
      });
      
      if (response.ok) {
        toast({
          title: "Deposit Approved",
          description: "Deposit has been approved successfully",
        });
        // Refresh data
        fetchAdminData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve deposit');
      }
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  // Function to reject deposit
  const rejectDeposit = async (depositId: string) => {
    if (!user?.id) return;
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const headers = getAdminHeaders();
      
      const response = await fetch(`${API_BASE}/api/deposits/${depositId}/reject`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notes: 'Rejected by admin' })
      });
      
      if (response.ok) {
        toast({
          title: "Deposit Rejected",
          description: "Deposit has been rejected",
        });
        // Refresh data
        fetchAdminData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject deposit');
      }
    } catch (error: any) {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  // Function to approve pending transaction
  const approvePendingTransaction = async (transactionId: string) => {
    if (!user?.id) return;
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const headers = getAdminHeaders();
      
      const response = await fetch(`${API_BASE}/api/admin/pending/${transactionId}/approve`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notes: 'Approved by admin' })
      });
      
      if (response.ok) {
        toast({
          title: "Transaction Approved",
          description: "Transaction has been approved successfully",
        });
        // Refresh data
        fetchAdminData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve transaction');
      }
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  // Function to reject pending transaction
  const rejectPendingTransaction = async (transactionId: string) => {
    if (!user?.id) return;
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const headers = getAdminHeaders();
      
      const response = await fetch(`${API_BASE}/api/admin/pending/${transactionId}/cancel`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notes: 'Rejected by admin' })
      });
      
      if (response.ok) {
        toast({
          title: "Transaction Rejected",
          description: "Transaction has been rejected",
        });
        // Refresh data
        fetchAdminData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject transaction');
      }
    } catch (error: any) {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  // Function to suspend/unsuspend user
  const toggleUserSuspension = async (userId: string, currentStatus: boolean) => {
    if (!user?.id) return;
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const headers = getAdminHeaders();
      
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ 
          suspended: !currentStatus,
          reason: !currentStatus ? 'Administrative action' : 'Account reinstated'
        })
      });
      
      if (response.ok) {
        toast({
          title: !currentStatus ? "User Suspended" : "User Activated",
          description: !currentStatus ? "User account has been suspended" : "User account has been activated",
        });
        // Refresh data
        fetchAdminData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user status');
      }
    } catch (error: any) {
      toast({
        title: "Operation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  useEffect(() => {
    if (user && user.email === ADMIN_EMAIL) {
      fetchAdminData();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground ml-3">Loading admin panel...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (user.email !== ADMIN_EMAIL) {
    console.log('🔒 [AUTH] User email:', user.email, 'Expected:', ADMIN_EMAIL);
    return <Navigate to="/" replace />;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);
  const suspendedUsers = users.filter(u => u.suspended).length;

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
              {errorMessage && (
                <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground hidden md:block">
              {users.length} users
            </div>
            
            <button 
              onClick={fetchAdminData}
              disabled={isLoadingAll}
              className="p-2 rounded-full hover:bg-secondary disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 text-foreground ${isLoadingAll ? 'animate-spin' : ''}`} />
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
            <p className="text-xs text-muted-foreground">Total Users</p>
            {isLoadingAll && (
              <p className="text-xs text-yellow-500 mt-1">Loading...</p>
            )}
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 mb-2">
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalBalance)}</p>
            <p className="text-xs text-muted-foreground">Total Balance</p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 mb-2">
              <Clock className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{pendingDeposits.length + pendingTransactions.length}</p>
            <p className="text-xs text-muted-foreground">Pending Total</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingAll && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading admin data...</p>
          </div>
        )}

        {/* Error State */}
        {errorMessage && !isLoadingAll && (
          <div className="bg-destructive/10 border border-destructive rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Error Loading Data</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
            <Button 
              onClick={fetchAdminData} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="users" className="text-xs">
              <Users className="w-4 h-4 mr-2" />
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="deposits" className="text-xs">
              <CreditCard className="w-4 h-4 mr-2" />
              Deposits ({pendingDeposits.length})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs">
              <FileText className="w-4 h-4 mr-2" />
              Transactions ({pendingTransactions.length})
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
              </div>
              <div className="text-sm">
                <span className="text-red-500">{suspendedUsers} suspended</span>
              </div>
            </div>
            
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No users found</p>
                <Button 
                  onClick={fetchAdminData} 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Users
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 rounded-2xl bg-card border border-border animate-fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.suspended ? 'bg-red-500/20' : 'bg-primary/10'}`}>
                          <span className={`text-sm font-semibold ${user.suspended ? 'text-red-500' : 'text-primary'}`}>
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'}`}>
                              {user.role === 'admin' ? 'Admin' : 'User'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${user.suspended ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                              {user.suspended ? 'Suspended' : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCurrency(user.balance)}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.createdAt ? formatDate(user.createdAt) : 'No date'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant={user.suspended ? "default" : "destructive"}
                        className="flex-1"
                        onClick={() => toggleUserSuspension(user.id, user.suspended || false)}
                      >
                        {user.suspended ? (
                          <>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Activate
                          </>
                        ) : (
                          <>
                            <UserX className="w-4 h-4 mr-2" />
                            Suspend
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits" className="space-y-3">
            {pendingDeposits.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pending deposits</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDeposits.map((deposit) => (
                  <div key={deposit._id} className="p-3 rounded-2xl bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{deposit.userName}</p>
                        <p className="text-xs text-muted-foreground">{deposit.userEmail}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                            {deposit.crypto}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(deposit.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCurrency(deposit.amount)}</p>
                        <p className="text-xs text-muted-foreground">{deposit.symbol}</p>
                      </div>
                    </div>
                    {deposit.address && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Address: {deposit.address}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => approveDeposit(deposit._id)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="flex-1"
                        onClick={() => rejectDeposit(deposit._id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-3">
            {pendingTransactions.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pending transactions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTransactions.map((transaction) => (
                  <div key={transaction._id} className="p-3 rounded-2xl bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{transaction.senderEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          To: {transaction.recipientEmail || `${transaction.recipientType} transfer`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                            {transaction.recipientType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(transaction.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCurrency(transaction.amount)}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>
                    {transaction.message && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Message: {transaction.message}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => approvePendingTransaction(transaction._id)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="flex-1"
                        onClick={() => rejectPendingTransaction(transaction._id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default AdminPage;
