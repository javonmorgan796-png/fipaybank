import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, History, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useDeposits } from "@/contexts/DepositsContext";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

interface CryptoOption {
  id: string;
  name: string;
  symbol: string;
  network?: string;
  icon: React.ReactNode;
  address: string;
  color: string;
}


interface CryptoPrices {
  BTC: number;
  ETH: number;
  USDT: number;
}

const BTCIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm7.189-17.98c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z" />
  </svg>
);

const ETHIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm7.994-15.781L16.498 4 9 16.22l7.498 4.353 7.496-4.354zM24 17.616l-7.502 4.351L9 17.617l7.498 10.378L24 17.616z" />
  </svg>
);

const USDTIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm1.922-18.207v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117zm0 3.59v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657z" />
  </svg>
);

const cryptoOptions: CryptoOption[] = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    icon: <BTCIcon />,
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    color: "bg-orange-500",
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    icon: <ETHIcon />,
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD2e",
    color: "bg-purple-500",
  },
  {
    id: "usdt",
    name: "Tether",
    symbol: "USDT",
    network: "TRC20",
    icon: <USDTIcon />,
    address: "TN3W4H6rK8SuPZjPSbxAhQaqPa1bZqpLZV",
    color: "bg-emerald-500",
  },
];

type Step = "amount" | "select" | "confirm" | "address";



const TopupPage = () => {
  const { user, isLoading } = useAuth();
  const { userDeposits, addDeposit } = useDeposits();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoOption | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrices>({ BTC: 104500, ETH: 3950, USDT: 1 });
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  useEffect(() => {
    fetchCryptoPrices();
  }, []);

  const fetchCryptoPrices = async () => {
    setIsLoadingPrices(true);
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd');
      const data = await response.json();
      setCryptoPrices({
        BTC: data.bitcoin?.usd || 104500,
        ETH: data.ethereum?.usd || 3950,
        USDT: data.tether?.usd || 1,
      });
    } catch (error) {
      console.log('Using fallback prices');
    } finally {
      setIsLoadingPrices(false);
    }
  };

  const getCryptoAmount = (usdAmount: number, symbol: string): string => {
    const price = cryptoPrices[symbol as keyof CryptoPrices] || 1;
    return (usdAmount / price).toFixed(symbol === 'USDT' ? 2 : 8);
  };

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

  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    const parts = numericValue.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmount(e.target.value);
    setAmount(formatted);
  };

  const handleContinue = () => {
    const numericAmount = parseFloat(amount.replace(/,/g, ""));
    if (!numericAmount || numericAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    setStep("select");
  };

  const handleSelectCrypto = (crypto: CryptoOption) => {
    setSelectedCrypto(crypto);
    setStep("confirm");
  };

  const handleConfirmTopup = () => {
    if (!selectedCrypto) return;
    
    const numericAmount = parseFloat(amount.replace(/,/g, ""));
    
    addDeposit({
      crypto: selectedCrypto.name,
      symbol: selectedCrypto.symbol,
      amount: numericAmount,
      cryptoAmount: getCryptoAmount(numericAmount, selectedCrypto.symbol),
      address: selectedCrypto.address,
      date: new Date().toISOString(),
      status: 'pending',
    });
    
    toast({ title: "Top-up initiated!", description: "Please send the crypto to the address shown. Admin will review your deposit." });
    setStep("address");
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const generateQRCodeUrl = (address: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`;
  };

  const handleBack = () => {
    if (step === "address") setStep("confirm");
    else if (step === "confirm") setStep("select");
    else if (step === "select") setStep("amount");
    else navigate(-1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (showHistory) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 pb-24">
          <div className="pt-6 flex items-center gap-4 animate-fade-in">
            <button onClick={() => setShowHistory(false)} className="p-2 rounded-full hover:bg-secondary">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Deposit History</h1>
          </div>

          <div className="mt-6 space-y-3">
            {userDeposits.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No deposit history yet</p>
              </div>
            ) : (
              userDeposits.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-2xl bg-card border border-border animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        record.symbol === 'BTC' ? 'bg-orange-500' :
                        record.symbol === 'ETH' ? 'bg-purple-500' : 'bg-emerald-500'
                      } text-white`}>
                        {record.symbol === 'BTC' && <BTCIcon />}
                        {record.symbol === 'ETH' && <ETHIcon />}
                        {record.symbol === 'USDT' && <USDTIcon />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{record.crypto}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(record.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">${record.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{record.cryptoAmount} {record.symbol}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        record.status === 'approved' ? 'bg-green-500/20 text-green-500' : 
                        record.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {record.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-2 rounded-full hover:bg-secondary">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Top Up Wallet</h1>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 rounded-full hover:bg-secondary"
          >
            <History className="w-6 h-6 text-foreground" />
          </button>
        </div>

        {/* Crypto Prices */}
        <div className="mt-6 p-4 rounded-2xl bg-card border border-border animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Live Prices</span>
            </div>
            <button
              onClick={fetchCryptoPrices}
              className="p-1 rounded-full hover:bg-secondary"
              disabled={isLoadingPrices}
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoadingPrices ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex justify-between gap-2">
            <div className="flex-1 text-center p-2 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground">BTC</p>
              <p className="text-sm font-bold text-foreground">${cryptoPrices.BTC.toLocaleString()}</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground">ETH</p>
              <p className="text-sm font-bold text-foreground">${cryptoPrices.ETH.toLocaleString()}</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground">USDT</p>
              <p className="text-sm font-bold text-foreground">${cryptoPrices.USDT.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {step === "amount" && (
          <div className="mt-8 animate-fade-in">
            <p className="text-muted-foreground text-center mb-6">
              Enter the amount you want to deposit
            </p>
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="text-center text-3xl font-bold h-16 pl-10 pr-4 bg-card border-border"
                />
              </div>
              <Button onClick={handleContinue} className="w-full h-12 text-lg">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="mt-8 space-y-4 animate-fade-in">
            <div className="rounded-2xl p-4 bg-primary/10 border border-primary/20 mb-6">
              <p className="text-sm text-muted-foreground">Deposit Amount</p>
              <p className="text-2xl font-bold text-foreground">${amount}</p>
            </div>
            <p className="text-muted-foreground text-center mb-4">
              Select a cryptocurrency to top up
            </p>
            {cryptoOptions.map((crypto, index) => {
              const numericAmount = parseFloat(amount.replace(/,/g, "")) || 0;
              const cryptoAmount = getCryptoAmount(numericAmount, crypto.symbol);
              
              return (
                <button
                  key={crypto.id}
                  onClick={() => handleSelectCrypto(crypto)}
                  className="w-full p-4 rounded-2xl bg-card border border-border hover:border-primary transition-all duration-200 flex items-center gap-4 animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`w-14 h-14 rounded-xl ${crypto.color} text-white flex items-center justify-center`}>
                    {crypto.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-semibold text-foreground">{crypto.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {crypto.symbol} {crypto.network && `(${crypto.network})`}
                    </p>
                    <p className="text-xs text-primary font-medium">
                      ≈ {cryptoAmount} {crypto.symbol}
                    </p>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                </button>
              );
            })}
          </div>
        )}

        {step === "confirm" && selectedCrypto && (
          <div className="mt-8 animate-fade-in">
            <div className="rounded-2xl p-6 bg-card border border-border">
              <h3 className="text-lg font-bold text-foreground text-center mb-6">Confirm Top-up</h3>
              
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-xl ${selectedCrypto.color} text-white flex items-center justify-center`}>
                  {selectedCrypto.icon}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between p-3 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">Amount (USD)</span>
                  <span className="font-bold text-foreground">${amount}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">Cryptocurrency</span>
                  <span className="font-bold text-foreground">{selectedCrypto.name}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">You'll Send</span>
                  <span className="font-bold text-primary">
                    {getCryptoAmount(parseFloat(amount.replace(/,/g, "")), selectedCrypto.symbol)} {selectedCrypto.symbol}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-bold text-foreground">
                    {selectedCrypto.network || (selectedCrypto.symbol === 'BTC' ? 'Bitcoin' : 'Ethereum')}
                  </span>
                </div>
              </div>

              <Button onClick={handleConfirmTopup} className="w-full h-12 text-lg mt-6">
                Confirm & Get Address
              </Button>
            </div>
          </div>
        )}

        {step === "address" && selectedCrypto && (
          <div className="mt-8 animate-fade-in">
            <div className="rounded-2xl p-4 bg-primary/10 border border-primary/20 mb-6">
              <p className="text-sm text-muted-foreground">Deposit Amount</p>
              <p className="text-2xl font-bold text-foreground">${amount}</p>
              <p className="text-sm text-primary font-medium">
                ≈ {getCryptoAmount(parseFloat(amount.replace(/,/g, "")), selectedCrypto.symbol)} {selectedCrypto.symbol}
              </p>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-xl ${selectedCrypto.color} text-white flex items-center justify-center`}>
                  {selectedCrypto.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{selectedCrypto.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCrypto.symbol} Deposit {selectedCrypto.network && `(${selectedCrypto.network})`}
                  </p>
                </div>
              </div>

              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 rounded-xl">
                  <img
                    src={generateQRCodeUrl(selectedCrypto.address)}
                    alt={`${selectedCrypto.name} QR Code`}
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Send only {selectedCrypto.symbol} {selectedCrypto.network && `(${selectedCrypto.network})`} to this address
                </p>
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-2">Wallet Address</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-foreground break-all flex-1">
                      {selectedCrypto.address}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyAddress(selectedCrypto.address)}
                      className="flex-shrink-0"
                    >
                      {copiedAddress === selectedCrypto.address ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Important: Only send {selectedCrypto.symbol} {selectedCrypto.network && `(${selectedCrypto.network})`} to this address. Sending other cryptocurrencies may result in permanent loss.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default TopupPage;