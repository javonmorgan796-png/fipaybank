import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home, Stats, Cards, Profile } from "@/components/wallet";
import { AuthProvider } from "@/contexts/AuthContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { DepositsProvider } from "@/contexts/DepositsContext";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import SendMoneyPage from "./components/wallet/pages/SendMoneyPage";
import ReceiveMoneyPage from "./components/wallet/pages/ReceiveMoneyPage";
import PersonalInfo from "./components/wallet/pages/PersonalInfo";
import AddCard from "./components/wallet/pages/AddCard";
import TransactionsPage from "./components/wallet/pages/TransactionsPage";
import TopupPage from "./components/wallet/pages/TopupPage";
import AdminPage from "./components/wallet/pages/AdminPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <WalletProvider>
          <NotificationProvider>
            <DepositsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/cards" element={<Cards />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/send" element={<SendMoneyPage />} />
                  <Route path="/receive" element={<ReceiveMoneyPage />} />
                  <Route path="/personal-info" element={<PersonalInfo />} />
                  <Route path="/add-card" element={<AddCard />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/topup" element={<TopupPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </DepositsProvider>
          </NotificationProvider>
        </WalletProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
