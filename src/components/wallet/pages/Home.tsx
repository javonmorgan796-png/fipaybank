// TestHome.tsx - Simplified version
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

const TestHome = () => {
  const { user, isLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    console.log("🔍 DEBUG - Auth state:", {
      user: user ? `Exists (${user.email})` : "null",
      isLoading,
      userId: user?.id
    });
    setDebugInfo(JSON.stringify({
      userExists: !!user,
      userId: user?.id,
      isLoading
    }, null, 2));
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("❌ No user found, redirecting to signin");
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Test Home Page - It's Working!</h1>
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Debug Information:</h2>
        <pre className="text-sm bg-gray-100 p-2 rounded">{debugInfo}</pre>
        
        <div className="mt-4">
          <h3 className="font-semibold">User Details:</h3>
          <p>ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Name: {user.name}</p>
          <p>Balance: ${user.balance}</p>
          <p>Suspended: {user.suspended ? "Yes" : "No"}</p>
        </div>
      </div>
      
      <div className="mt-4">
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
};

export default TestHome;
