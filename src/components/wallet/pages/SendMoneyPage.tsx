import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const CRYPTOCURRENCIES = [
  { id: "btc", name: "Bitcoin", symbol: "BTC" },
  { id: "eth", name: "Ethereum", symbol: "ETH" },
  { id: "usdt", name: "Tether", symbol: "USDT" },
];

const SendMoneyPage = () => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [recipientType, setRecipientType] = useState<"email" | "crypto" | "bank">("email");
  const [recipientInput, setRecipientInput] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    accountName: "",
    bankName: "",
  });

  const [amount, setAmount] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState("btc");
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) return null;
  if (!user) return <Navigate to="/signin" replace />;

  const amountNum = parseFloat(amount);

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (amountNum <= 0 || isNaN(amountNum)) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return false;
    }

    if (recipientType === "email" && !recipientInput) {
      toast({ title: "Error", description: "Recipient email required", variant: "destructive" });
      return false;
    }

    if (recipientType === "crypto" && !recipientInput) {
      toast({ title: "Error", description: "Wallet address required", variant: "destructive" });
      return false;
    }

    if (
      recipientType === "bank" &&
      !bankDetails.accountNumber &&
      !bankDetails.accountName
    ) {
      toast({ title: "Error", description: "Bank details required", variant: "destructive" });
      return false;
    }

    return true;
  };

  /* ================= SEND MONEY ================= */
  const sendMoney = async () => {
    setShowConfirm(false);
    setIsSending(true);

    try {
      const base = import.meta.env.VITE_API_URL || "";

      const payload = {
        recipientType,
        recipientEmail: recipientType === "email" ? recipientInput.trim().toLowerCase() : undefined,
        recipientDetails:
          recipientType === "crypto"
            ? { address: recipientInput.trim() }
            : recipientType === "bank"
            ? bankDetails
            : undefined,
        amount: amountNum,
        crypto: selectedCrypto,
        symbol: CRYPTOCURRENCIES.find(c => c.id === selectedCrypto)?.symbol || "",
      };

      const res = await fetch(`${base}/api/transactions/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send money");
      }

      toast({
        title: "Success",
        description: data.message || "Transaction created and pending approval",
      });

      navigate("/");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-background px-4">
      <div className="max-w-md mx-auto pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-4">
          <ArrowLeft /> Back
        </button>

        <h1 className="text-2xl font-bold mb-4">Send Money</h1>

        {/* Recipient Type */}
        <Select value={recipientType} onValueChange={(v: any) => setRecipientType(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select recipient type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="crypto">Crypto Wallet</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
          </SelectContent>
        </Select>

        {/* Recipient Input */}
        {recipientType !== "bank" && (
          <Input
            className="mt-3"
            placeholder={
              recipientType === "email"
                ? "Recipient email"
                : "Wallet address"
            }
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
          />
        )}

        {/* Bank Fields */}
        {recipientType === "bank" && (
          <div className="space-y-2 mt-3">
            <Input
              placeholder="Account Number"
              value={bankDetails.accountNumber}
              onChange={(e) =>
                setBankDetails({ ...bankDetails, accountNumber: e.target.value })
              }
            />
            <Input
              placeholder="Account Name"
              value={bankDetails.accountName}
              onChange={(e) =>
                setBankDetails({ ...bankDetails, accountName: e.target.value })
              }
            />
            <Input
              placeholder="Bank Name"
              value={bankDetails.bankName}
              onChange={(e) =>
                setBankDetails({ ...bankDetails, bankName: e.target.value })
              }
            />
          </div>
        )}

        {/* Amount */}
        <Input
          className="mt-3"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* Crypto */}
        {recipientType === "crypto" && (
          <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRYPTOCURRENCIES.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          className="w-full mt-6"
          disabled={isSending}
          onClick={() => validate() && setShowConfirm(true)}
        >
          {isSending ? "Sending..." : "Send Money"}
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
          </DialogHeader>
          <p className="text-sm mb-4">
            You are about to send <strong>${amountNum.toFixed(2)}</strong>
          </p>
          <div className="flex gap-2">
            <Button onClick={sendMoney} className="w-full">
              Confirm
            </Button>
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="w-full">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SendMoneyPage;
