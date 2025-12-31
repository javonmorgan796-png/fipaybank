import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

const ReceiveMoneyPage = () => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(user.email);
    setCopied(true);
    toast({ title: "Copied!", description: "Email address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 flex items-center gap-4 animate-fade-in">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Receive Money</h1>
        </div>

        <div className="mt-8 flex flex-col items-center animate-slide-up">
          <div className="w-48 h-48 bg-card rounded-2xl flex items-center justify-center card-shadow">
            <div className="text-center">
              <QrCode className="w-24 h-24 text-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">QR Code</p>
            </div>
          </div>

          <p className="mt-6 text-muted-foreground text-center">
            Share your email address to receive money
          </p>

          <div className="mt-4 w-full p-4 bg-card rounded-xl card-shadow">
            <p className="text-sm text-muted-foreground mb-1">Your Email</p>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground truncate">{user.email}</p>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="mt-4 w-full p-4 bg-card rounded-xl card-shadow">
            <p className="text-sm text-muted-foreground mb-1">Your Name</p>
            <p className="font-semibold text-foreground">{user.name}</p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default ReceiveMoneyPage;
