import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Users, DollarSign, Clock, Check, X, Search, Shield, ChevronLeft, ChevronRight, Filter, RefreshCw, AlertCircle } from "lucide-react";
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
  const { user, isLoading, token } = useAuth(); // Make sure useAuth provides token
  const { allDeposits, approveDeposit, rejectDeposit, fetchDeposits } = useDeposits();
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
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Helper function to get headers based on endpoint type
  const getHeaders = (endpointType: 'admin' | 'user' | 'both' = 'both') => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    // Always add admin header for admin endpoints
    if (endpointType === 'admin' || endpointType === 'both') {
      headers['x-admin'] = 'admin';
    }
    
    // Add user token for user endpoints (if available)
    if ((endpointType === 'user' || endpointType === 'both') && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  };
  
  // Function to fetch users with admin headers
  const fetchUsersData = async () => {
    setIsLoadingUsers(true);
    setErrorMessage(null);
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      
      const response = await fetch(`${API_BASE}/api/users`, { 
        headers: getHeaders('admin') // Admin-only endpoint
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch users`);
      }
      
      const data = await response.json();
      let userArray = [];
      
      if (Array.isArray(data.users)) {
        userArray = data.users;
      } else if (Array.isArray(data)) {
        userArray = data;
      }
      
      const userList: UserData[] = userArray.map((u: any) => ({
        email: u.email || '',
        name: u.name || 'Unknown',
        balance: u.balance || 0,
        id: u._id || u.id || '',
        suspended: u.suspended || false,
      }));
      
      setUsers(userList);
      
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setErrorMessage(error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Fix deposits fetching - use user token
  useEffect(() => {
    // If useDeposits context isn't working for admin, fetch deposits manually
    const fetchAdminDeposits = async () => {
      if (!token) return;
      
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
        const response = await fetch(`${API_BASE}/api/deposits`, {
          headers: getHeaders('user') // User endpoint needs token
        });
        
        if (!response.ok) {
          console.warn('Failed to fetch deposits:', response.status);
          // Don't show error toast for deposits, they're less critical
        }
      } catch (error) {
        console.error('Error fetching deposits:', error);
      }
    };
    
    fetchAdminDeposits();
  }, [token]);
  
  // Fetch users on component mount
  useEffect(() => {
    fetchUsersData();
  }, []);
  
  // Fix: Update useDeposits context to work with admin
  // If the deposits context requires auth, we need to handle it differently
  const handleApproveWithAuth = async (depositId: string) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const response = await fetch(`${API_BASE}/api/deposits/${depositId}/approve`, {
        method: 'PUT',
        headers: getHeaders('both') // May need both admin and user auth
      });
      
      if (response.ok) {
        approveDeposit(depositId);
        toast({ title: "Deposit Approved", description: "User has been notified and balance updated." });
      } else {
        throw new Error(`Failed to approve deposit: ${response.status}`);
      }
    } catch (error: any) {
      toast({ 
        title: "Approval Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };
  
  const handleRejectWithAuth = async (depositId: string) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const response = await fetch(`${API_BASE}/api/deposits/${depositId}/reject`, {
        method: 'PUT',
        headers: getHeaders('both') // May need both admin and user auth
      });
      
      if (response.ok) {
        rejectDeposit(depositId);
        toast({ title: "Deposit Rejected", description: "User has been notified.", variant: "destructive" });
      } else {
        throw new Error(`Failed to reject deposit: ${response.status}`);
      }
    } catch (error: any) {
      toast({ 
        title: "Rejection Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading admin panel...</p>
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

  // Fix pending transfers fetch
  useEffect(() => {
    const fetchPendingItems = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || 'https://fipaybank.onrender.com';
        const [res1, res2] = await Promise.all([
          fetch(`${API_BASE}/api/admin/pending`, { headers: getHeaders('admin') }),
          fetch(`${API_BASE}/api/admin/pending-recipient`, { headers: getHeaders('admin') })
        ]);
        
        if (res1.ok) {
          const data = await res1.json();
          setPendingTransfers(data.pendings || []);
        }
        if (res2.ok) {
          const data2 = await res2.json();
          setPendingRecipients(data2.pendingRecipients || []);
        }
      } catch (err) { 
        console.error('fetch pending items error', err); 
      }
    };
    
    fetchPendingItems();
  }, []);

  // Rest of your component remains mostly the same, but update the button handlers:

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);

  // Update your existing approve/reject buttons to use the new handlers:
  // In the deposits section, change:
  // onClick={() => handleApprove(deposit.id)} -> onClick={() => handleApproveWithAuth(deposit.id)}
  // onClick={() => handleReject(deposit.id)} -> onClick={() => handleRejectWithAuth(deposit.id)}

  // Also update the suspend button to use proper headers:
  const handleSuspendUser = async (userId: string, currentSuspended: boolean) => {
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: getHeaders('admin'),
        body: JSON.stringify({ suspended: !currentSuspended })
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended: data.user?.suspended ?? !currentSuspended } : u));
        toast({
          title: currentSuspended ? 'User Unsuspended' : 'User Suspended',
          description: currentSuspended ? 'User can access the account.' : 'User access is blocked.'
        });
      } else {
        throw new Error(`Failed to update user: ${res.status}`);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Pagination and filtering logic remains the same...

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        {/* Header - Add token info for debugging */}
        <div className="pt-6 pb-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-secondary">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Logged in as: {user.email} {token ? '✓ Has token' : '✗ No token'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchUsersData}
              disabled={isLoadingUsers}
              className="p-2 rounded-full hover:bg-secondary disabled:opacity-50"
              title="Refresh Users"
            >
              <RefreshCw className={`w-5 h-5 text-foreground ${isLoadingUsers ? 'animate-spin' : ''}`} />
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
            <p className="text-xs text-muted-foreground">Total Balance</p>
          </div>
          <div className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 mb-2">
              <Clock className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-lg font-bold text-foreground">{pendingDeposits.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Main content - Update the suspend button in users tab */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="deposits" className="text-xs">
              Pending ({pendingDeposits.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>

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
            
            {users.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No users found</p>
                <Button onClick={fetchUsersData} variant="outline" size="sm" className="mt-3">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Load Users
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="p-3 rounded-2xl bg-card border border-border animate-fade-in">
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
                            onClick={() => handleSuspendUser(u.id, u.suspended || false)}
                          >
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Other tabs... */}
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default AdminPage;
