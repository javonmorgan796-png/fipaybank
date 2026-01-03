import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, Send, ScanLine } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

const CRYPTOCURRENCIES = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", icon: "₿", color: "text-orange-500" },
  { id: "eth", name: "Ethereum", symbol: "ETH", icon: "Ξ", color: "text-blue-500" },
  { id: "usdt", name: "Tether", symbol: "USDT", icon: "$", color: "text-green-500" },
  { id: "bnb", name: "BNB", symbol: "BNB", icon: "B", color: "text-yellow-500" },
  { id: "xrp", name: "Ripple", symbol: "XRP", icon: "X", color: "text-gray-500" },
];

const SendMoneyPage = () => {
  const { user, isLoading } = useAuth();
  const { sendMoney, getRecentContacts, cards } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [recipientType, setRecipientType] = useState<'email' | 'crypto' | 'bank'>('crypto');
  const [recipientInput, setRecipientInput] = useState(""); // email or wallet address
  const [bankDetails, setBankDetails] = useState<{ 
    accountNumber?: string; 
    accountName?: string; 
    bankName?: string;
    username?: string;
  }>({});

  // Payment method selection: 'balance' (wallet balance) or 'card'
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'card'>('balance');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // Once set, the payment method is locked; show only the selected method (user can change via 'Change' link)
  const [paymentMethodLocked, setPaymentMethodLocked] = useState(false);

  const setPaymentMethodLockedChoice = (method: 'balance' | 'card') => {
    setPaymentMethod(method);
    setPaymentMethodLocked(true);
  };
  
  const [amount, setAmount] = useState("");
  const [displayAmount, setDisplayAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string>("btc");
  const [showScanner, setShowScanner] = useState(false);

  // Confirmation & pending UI state
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [lastPending, setLastPending] = useState<any>(null);

  useEffect(() => {
    if (!selectedCardId && cards && cards.length > 0) setSelectedCardId(cards[0].id);
  }, [cards]);

  // Compute disabled state based on recipient, amount and payment method
  const _amountNum = parseFloat(amount || '0');
  const isDisabled = isSending || 
    (recipientType !== 'bank' && !recipientInput) || 
    (recipientType === 'bank' && !bankDetails.accountNumber && !bankDetails.accountName && !bankDetails.username) || 
    isNaN(_amountNum) || 
    _amountNum <= 0 || 
    (recipientType === 'crypto' && !recipientInput) || 
    (paymentMethod === 'card' && !selectedCardId);

  const formatAmountWithCommas = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
      setAmount(rawValue);
      setDisplayAmount(formatAmountWithCommas(rawValue));
    }
  };

  const recentContacts = getRecentContacts();

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

  const handleSend = async () => {
    // basic validation
    if (!recipientInput && recipientType !== 'bank') {
      toast({ title: "Error", description: "Please provide recipient info", variant: "destructive" });
      return;
    }
    if (recipientType === 'bank' && !bankDetails.accountNumber && !bankDetails.accountName && !bankDetails.username) {
      toast({ title: "Error", description: "Please provide bank account details", variant: "destructive" });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    // card selection validation
    if (paymentMethod === 'card' && !selectedCardId) {
      toast({ title: 'Error', description: 'Please select a card', variant: 'destructive' });
      return;
    }

    // Show confirmation modal
    setShowConfirm(true);
  };

  const sendConfirmed = async () => {
    setShowConfirm(false);
    setIsSending(true);

    const amountNum = parseFloat(amount);

    // If email recipient, create pending recipient first
    if (recipientType === 'email') {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        
        // Add authentication headers - removed isAdmin since it doesn't exist on User type
        const headers = {
          'Content-Type': 'application/json',
          'x-user-id': user.id || '',
        };
        
        await fetch(`${base}/api/pending-recipient`, {
          method: 'POST', 
          headers,
          body: JSON.stringify({ 
            email: recipientInput.trim().toLowerCase(), 
            name: '', 
            createdBy: user.id 
          })
        });
      } catch (e) { 
        console.error('create pending recipient failed', e); 
      }
    }

    // Build recipientDetails for API - use email
    const details = recipientType === 'bank' ? {
      ...bankDetails,
      // Use user's email
      username: bankDetails.username || user.email || ''
    } : (recipientType === 'crypto' ? { 
      address: recipientInput.trim() 
    } : undefined);

    // Debug log payload
    console.log('[sendConfirmed] payload', { 
      recipientType, 
      recipientInput, 
      details, 
      amountNum, 
      selectedCrypto, 
      paymentMethod, 
      selectedCardId 
    });

    const selectedCryptoData = CRYPTOCURRENCIES.find(c => c.id === selectedCrypto);
    
    // Call sendMoney with authentication context
    const sendMoneyWithAuth = async () => {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        
        const headers = {
          'Content-Type': 'application/json',
          'x-user-id': user.id || '',
        };
        
        const response = await fetch(`${base}/api/transactions/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recipientType,
            recipient: recipientInput.trim(),
            details,
            amount: amountNum,
            selectedCrypto,
            cryptoCurrency: selectedCryptoData?.symbol || '',
            paymentMethod,
            cardId: selectedCardId || undefined,
            userId: user.id
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to send money');
        }
        
        return { success: true, ...data };
      } catch (error: any) {
        console.error('Send money error:', error);
        return { 
          success: false, 
          message: error.message || 'An error occurred while sending money'
        };
      }
    };
    
    const result = await sendMoneyWithAuth();
    
    setIsSending(false);

    if (result.success) {
      if (result.pendingId) {
        setLastPending(result.pendingId ? { _id: result.pendingId } : null);
        setShowPendingDialog(true);
        toast({ title: "Pending", description: "Transfer created and is pending admin approval." });
      } else {
        toast({ title: "Success", description: result.message });
      }
      navigate("/");
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleContactClick = (email: string) => {
    setRecipientInput(email);
  };

  const handleScanQR = () => {
    setShowScanner(true);
  };

  const handleScanComplete = (address: string) => {
    setRecipientInput(address);
    setShowScanner(false);
    toast({ title: "Address Scanned", description: "Wallet address captured successfully" });
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(balance);
  };

  const selectedCryptoData = CRYPTOCURRENCIES.find(c => c.id === selectedCrypto);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 flex items-center gap-4 animate-fade-in">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Send Money</h1>
        </div>

        <div className="mt-6 text-center animate-slide-up">
          <p className="text-muted-foreground text-sm">Available Balance</p>
          <p className="text-2xl font-bold text-foreground">{formatBalance(user.balance || 0)}</p>
        </div>

        <div className="mt-8 space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Cryptocurrency Selection (only when recipient method is crypto) */}
          {recipientType === 'crypto' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Cryptocurrency</label>
              <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select a cryptocurrency">
                    {selectedCryptoData && (
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${selectedCryptoData.color}`}>
                          {selectedCryptoData.icon}
                        </span>
                        <span>{selectedCryptoData.name} ({selectedCryptoData.symbol})</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CRYPTOCURRENCIES.map((crypto) => (
                    <SelectItem key={crypto.id} value={crypto.id}>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${crypto.color}`}>{crypto.icon}</span>
                        <span>{crypto.name} ({crypto.symbol})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recipient Input */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Recipient Method</label>
            <div className="flex gap-2 mb-3">
              <Button variant={recipientType === 'email' ? 'secondary' : 'ghost'} onClick={() => setRecipientType('email')}>Email</Button>
              <Button variant={recipientType === 'crypto' ? 'secondary' : 'ghost'} onClick={() => setRecipientType('crypto')}>Crypto Wallet</Button>
              <Button variant={recipientType === 'bank' ? 'secondary' : 'ghost'} onClick={() => setRecipientType('bank')}>Bank Account</Button>
            </div>

            {recipientType === 'email' && (
              <Input
                placeholder="Recipient email address"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                className="pl-3"
              />
            )}

            {recipientType === 'crypto' && (
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Wallet address"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleScanQR}
                  className="h-10 w-10 shrink-0"
                >
                  <ScanLine className="w-5 h-5" />
                </Button>
              </div>
            )}

            {recipientType === 'bank' && (
              <div className="space-y-2">
                <Input
                  placeholder="Account number"
                  value={bankDetails.accountNumber || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                />
                <Input
                  placeholder="Account name / username"
                  value={bankDetails.accountName || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                />
                <Input
                  placeholder="Bank name"
                  value={bankDetails.bankName || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                />
                <Input
                  placeholder="Username (optional)"
                  value={bankDetails.username || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, username: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Payment Method</label>
            <div className="flex gap-2 mb-3">
              {!paymentMethodLocked ? (
                <>
                  <Button variant={paymentMethod === 'balance' ? 'secondary' : 'ghost'} onClick={() => setPaymentMethodLockedChoice('balance')}>Wallet Balance</Button>
                  <Button variant={paymentMethod === 'card' ? 'secondary' : 'ghost'} onClick={() => setPaymentMethodLockedChoice('card')}>Card</Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 rounded bg-muted text-sm">{paymentMethod === 'balance' ? 'Wallet Balance' : 'Card'}</div>
                  <Button variant="link" onClick={() => setPaymentMethodLocked(false)}>Change</Button>
                </div>
              )}
            </div>

            {paymentMethod === 'card' && (
              <div className="space-y-2">
                {cards && cards.length > 0 ? (
                  <div className="space-y-2">
                    {cards.map(c => (
                      <div key={c.id} className={`p-2 border rounded ${selectedCardId === c.id ? 'border-accent' : 'border-border'}`} onClick={() => setSelectedCardId(c.id)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{c.type} •••• {c.lastFour}</div>
                            <div className="text-xs text-muted-foreground">{c.holderName}</div>
                          </div>
                          <div className="text-xs">{c.expiryDate}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No cards found — add one in your profile.</div>
                )}
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Amount (USD)</label>
            <Input
              type="text"
              placeholder="Enter amount"
              value={displayAmount}
              onChange={handleAmountChange}
              className="text-2xl font-bold text-center py-6"
            />
          </div>
        </div>

        {recentContacts.length > 0 && (
          <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Contacts</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact.email)}
                  className="flex flex-col items-center gap-2 flex-shrink-0 group"
                >
                  <Avatar className="w-14 h-14 ring-2 ring-transparent group-hover:ring-accent transition-all">
                    <AvatarFallback className="bg-secondary text-foreground font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">{contact.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={isDisabled}
          className="w-full mt-8 py-6 text-lg animate-slide-up"
          style={{ animationDelay: '0.3s' }}
        >
          <Send className="w-5 h-5 mr-2" />
          {isSending ? "Sending..." : `Send ${selectedCryptoData?.symbol || 'Money'}`}
        </Button>
      </div>

      {/* Confirm Dialog: show before creating pending */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-2">You are about to create a transfer:</p>
            <ul className="text-sm space-y-1 mb-4">
              <li><strong>Recipient method:</strong> {recipientType}</li>
              <li><strong>Recipient:</strong> {recipientType === 'crypto' ? recipientInput : (recipientType === 'email' ? recipientInput : (bankDetails.accountNumber || bankDetails.accountName || ''))}</li>
              <li><strong>Amount:</strong> ${parseFloat(amount || '0').toFixed(2)}</li>
              <li><strong>Payment method:</strong> {paymentMethod === 'card' ? 'Card' : 'Wallet Balance'}</li>
            </ul>
            <div className="flex gap-2">
              <Button onClick={sendConfirmed} className="w-full">Create Pending (Admin approval)</Button>
              <Button variant="outline" onClick={() => setShowConfirm(false)} className="w-full">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending created Dialog */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Pending</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Transfer has been created and is pending admin approval.</p>
            {lastPending && (
              <p className="text-sm text-muted-foreground mt-2">Pending ID: <span className="font-mono">{lastPending._id}</span></p>
            )}
            <div className="flex gap-2 mt-4">
              <Button onClick={() => { setShowPendingDialog(false); navigate('/admin'); }} className="w-full">Open Admin</Button>
              <Button variant="outline" onClick={() => setShowPendingDialog(false)} className="w-full">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-64 h-64 bg-muted rounded-2xl flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center">
                <ScanLine className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Camera access required</p>
                <p className="text-xs text-muted-foreground mt-1">Point camera at QR code</p>
              </div>
            </div>
            <div className="w-full space-y-3">
              <p className="text-sm text-muted-foreground text-center">Or enter address manually:</p>
              <Input
                placeholder="Paste wallet address"
                onChange={(e) => {
                  if (e.target.value.length > 10) {
                    handleScanComplete(e.target.value);
                  }
                }}
              />
            </div>
            <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SendMoneyPage;
