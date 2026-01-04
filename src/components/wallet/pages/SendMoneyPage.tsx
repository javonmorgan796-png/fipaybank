import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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

  // ✅ Amount handling (RAW + DISPLAY)
  const [rawAmount, setRawAmount] = useState("");
  const [displayAmount, setDisplayAmount] = useState("");

  const [selectedCrypto, setSelectedCrypto] = useState("btc");
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) return null;
  if (!user) return <Navigate to="/signin" replace />;

  /* ================= HELPERS ================= */

  const formatWithCommas = (value: string) => {
    if (!value) return "";
    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const amountNum = Number(rawAmount);

  /* ================= VALIDATION ================= */

  const validate = () => {
    if (!rawAmount || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return false;
    }

    if (recipientType === "email" && !recipientInput.trim()) {
      toast({ title: "Error", description: "Recipient email is required", variant: "destructive" });
      return false;
    }

    if (recipientType === "crypto" && !recipientInput.trim()) {
      toast({ title: "Error", description: "Wallet address is required", variant: "destructive" });
      return false;
    }

    if (
      recipientType === "bank" &&
      !bankDetails.accountNumber &&
      !bankDetails.accountName
    ) {
      toast({ title: "Error", description: "Bank details are required", variant: "destructive" });
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
        recipientEmail:
          recipientType === "email"
            ? recipientInput.trim().toLowerCase()
            : undefined,
        recipientDetails:
          recipientType === "crypto"
            ? { address: recipientInput.trim() }
            : recipientType === "bank"
            ? bankDetails
            : undefined,
        amount: amountNum,
        crypto: selectedCrypto,
        symbol:
          CRYPTOCURRENCIES.find(c => c.id === selectedCrypto)?.symbol || "",
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
    <div className="min-h-screen bg-gray-50 px-4">
      <div className="max-w-md mx-auto pt-8">

        {/* Header */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-4 text-gray-600">
          <ArrowLeft size={18} /> Back
        </button>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">

          <h1 className="text-xl font-semibold text-center">Send Money</h1>

          {/* Recipient Type */}
          <div>
            <label className="text-sm font-medium text-gray-600">Recipient Type</label>
            <Select value={recipientType} onValueChange={(v: any) => setRecipientType(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="crypto">Crypto Wallet</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipient Input */}
          {recipientType !== "bank" && (
            <div>
              <label className="text-sm font-medium text-gray-600">
                {recipientType === "email" ? "Recipient Email" : "Wallet Address"}
              </label>
              <Input
                className="mt-1"
                placeholder={recipientType === "email" ? "example@email.com" : "Wallet address"}
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
              />
            </div>
          )}

          {/* Bank Details */}
          {recipientType === "bank" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Account Number</label>
                <Input
                  className="mt-1"
                  value={bankDetails.accountNumber}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Account Name</label>
                <Input
                  className="mt-1"
                  value={bankDetails.accountName}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, accountName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Bank Name</label>
                <Input
                  className="mt-1"
                  value={bankDetails.bankName}
                  onChange={(e) =>
                    setBankDetails({ ...bankDetails, bankName: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-gray-600">Amount</label>
            <Input
              className="mt-1 text-lg"
              placeholder="0.00"
              value={displayAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/,/g, "");
                if (!/^\d*\.?\d*$/.test(value)) return;
                setRawAmount(value);
                setDisplayAmount(formatWithCommas(value));
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Available balance: ${formatWithCommas(String(user.balance || 0))}
            </p>
          </div>

          {/* Crypto Select */}
          {recipientType === "crypto" && (
            <div>
              <label className="text-sm font-medium text-gray-600">Cryptocurrency</label>
              <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                <SelectTrigger className="mt-1">
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
            </div>
          )}

          {/* Send Button */}
          <Button
            className="w-full h-12 rounded-xl"
            disabled={isSending}
            onClick={() => validate() && setShowConfirm(true)}
          >
            {isSending ? "Sending..." : "Send Money"}
          </Button>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
          </DialogHeader>
          <p className="text-sm mb-4">
            You are about to send <strong>${formatWithCommas(rawAmount)}</strong>
          </p>
          <div className="flex gap-2">
            <Button className="w-full" onClick={sendMoney}>
              Confirm
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SendMoneyPage;
