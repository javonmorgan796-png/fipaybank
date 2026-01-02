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
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Helper function to get admin headers
  const getAdminHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-admin': 'admin'
    };
  };
  
  // Function to fetch users with detailed logging
  const fetchUsersData = async () => {
    setIsLoadingUsers(true);
    setErrorMessage(null);
    
    try {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      console.log('🔄 [DEBUG] Fetching users from:', `${API_BASE}/api/users`);
      console.log('🔄 [DEBUG] Using headers:', getAdminHeaders());
      
      const response = await fetch(`${API_BASE}/api/users`, { 
        headers: getAdminHeaders()
      });
      
      console.log('📊 [DEBUG] Response status:', response.status);
      console.log('📊 [DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Get response text first
      const responseText = await response.text();
      console.log('📊 [DEBUG] Raw response text:', responseText);
      
      let data: any = null;
      try {
        data = JSON.parse(responseText);
        console.log('📊 [DEBUG] Parsed JSON data:', data);
      } catch (parseError) {
        console.error('❌ [DEBUG] Failed to parse JSON:', parseError);
        setErrorMessage(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        toast({
          title: "Server Error",
          description: "Server returned invalid response format",
          variant: "destructive"
        });
        setIsLoadingUsers(false);
        return;
      }
      
      if (!response.ok) {
        console.error('❌ [DEBUG] API Error:', data);
        setErrorMessage(data.error || `HTTP ${response.status}: ${responseText}`);
        toast({
          title: "Fetch Failed",
          description: data.error || `Server error: ${response.status}`,
          variant: "destructive"
        });
        setIsLoadingUsers(false);
        return;
      }
      
      // Try different response structures
      let userArray = [];
      
      if (Array.isArray(data.users)) {
        userArray = data.users;
      } else if (Array.isArray(data)) {
        userArray = data;
      } else if (data.data && Array.isArray(data.data)) {
        userArray = data.data;
      } else if (data.success && Array.isArray(data.data)) {
        userArray = data.data;
      } else {
        console.warn('⚠️ [DEBUG] Unexpected response structure:', data);
        // Try to extract users from any property
        const allKeys = Object.keys(data);
        for (const key of allKeys) {
          if (Array.isArray(data[key])) {
            userArray = data[key];
            console.log(`📊 [DEBUG] Found users in property: ${key}`);
            break;
          }
        }
      }
      
      console.log(`✅ [DEBUG] Extracted ${userArray.length} users from response`);
      
      if (userArray.length === 0) {
        console.warn('⚠️ [DEBUG] No users found in response');
        setErrorMessage("No users found in server response");
      }
      
      const userList: UserData[] = userArray.map((u: any, index: number) => ({
        email: u.email || u.userEmail || `user${index}@example.com`,
        name: u.name || u.userName || u.username || `User ${index}`,
        balance: Number(u.balance) || Number(u.amount) || 0,
        id: u._id || u.id || `temp-id-${index}`,
        suspended: u.suspended || u.isSuspended || false,
      }));
      
      console.log('✅ [DEBUG] Final user list:', userList);
      setUsers(userList);
      
      if (userList.length > 0) {
        toast({
          title: "Users Loaded",
          description: `Successfully loaded ${userList.length} users`
        });
      }
      
    } catch (error: any) {
      console.error('❌ [DEBUG] Network error:', error);
      setErrorMessage(`Network error: ${error.message}`);
      toast({
        title: "Network Error",
        description: "Could not connect to server",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  useEffect(() => {
    fetchUsersData();
  }, [allDeposits]);

  // Test the API endpoint directly
  useEffect(() => {
    // Test the endpoint when component mounts
    const testEndpoint = async () => {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
      console.log('🧪 [TEST] Testing endpoint:', `${API_BASE}/api/users`);
      
      try {
        const testRes = await fetch(`${API_BASE}/api/users`, {
          headers: getAdminHeaders()
        });
        const text = await testRes.text();
        console.log('🧪 [TEST] Test response status:', testRes.status);
        console.log('🧪 [TEST] Test response:', text.substring(0, 200));
      } catch (testError) {
        console.error('🧪 [TEST] Test failed:', testError);
      }
    };
    
    testEndpoint();
  }, []);

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
    console.log('🔒 [AUTH] User email:', user.email, 'Expected:', ADMIN_EMAIL);
    return <Navigate to="/" replace />;
  }

  const pendingDeposits = allDeposits.filter(d => d.status === 'pending');
  const processedDeposits = allDeposits.filter(d => d.status !== 'pending');

  // Rest of your existing code remains the same, but let's update the header section:

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);

  // ... (keep all your existing helper functions and state)

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
            {/* Debug Info */}
            <div className="text-xs text-muted-foreground hidden md:block">
              {users.length} users
            </div>
            
            {/* Force Refresh Button */}
            <button 
              onClick={fetchUsersData}
              disabled={isLoadingUsers}
              className="p-2 rounded-full hover:bg-secondary disabled:opacity-50"
              title="Refresh Users"
            >
              <RefreshCw className={`w-5 h-5 text-foreground ${isLoadingUsers ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Direct API Test Button */}
            <button 
              onClick={async () => {
                const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'https://fipaybank.onrender.com';
                console.log('🔍 Testing direct API call...');
                
                // Test with and without headers
                const tests = [
                  { name: 'With admin header', headers: getAdminHeaders() },
                  { name: 'Without headers', headers: {} },
                  { name: 'With only accept header', headers: { 'Accept': 'application/json' } },
                ];
                
                for (const test of tests) {
                  try {
                    console.log(`🧪 Testing: ${test.name}`);
                    const res = await fetch(`${API_BASE}/api/users`, { headers: test.headers });
                    const text = await res.text();
                    console.log(`🧪 ${test.name}: Status ${res.status}, Response:`, text.substring(0, 200));
                    
                    toast({
                      title: `Test: ${test.name}`,
                      description: `Status: ${res.status}`,
                      variant: res.ok ? "default" : "destructive"
                    });
                  } catch (err) {
                    console.error(`🧪 ${test.name} failed:`, err);
                  }
                }
              }}
              className="p-2 rounded-full hover:bg-secondary"
              title="Test API Endpoints"
            >
              <AlertCircle className="w-5 h-5 text-foreground" />
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
            {isLoadingUsers && (
              <p className="text-xs text-yellow-500 mt-1">Loading...</p>
            )}
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

        {/* Loading State */}
        {isLoadingUsers && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
          </div>
        )}

        {/* Error State */}
        {errorMessage && !isLoadingUsers && (
          <div className="bg-destructive/10 border border-destructive rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Error Loading Users</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
            <Button 
              onClick={fetchUsersData} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {/* Main Content - Only show if we have data or no error */}
        {!errorMessage && (
          <Tabs defaultValue="deposits" className="w-full">
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

            {/* Users Tab */}
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
                  <Button 
                    onClick={fetchUsersData} 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Load Users
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
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
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Other tabs remain the same */}
            <TabsContent value="deposits" className="space-y-3">
              {/* ... your existing deposits content ... */}
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Pending deposits will appear here</p>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {/* ... your existing history content ... */}
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Transaction history will appear here</p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default AdminPage;
