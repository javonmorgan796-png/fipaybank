import { useState, useEffect } from "react";
import { RefreshCw, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CryptoPrices {
  BTC: number;
  ETH: number;
  USDT: number;
}

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ' },
  { code: 'USDT', name: 'Tether', symbol: '₮' },
];

export const CurrencyConverter = () => {
  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("BTC");
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrices>({ BTC: 85000, ETH: 2900, USDT: 1 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd');
      const data = await response.json();
      setCryptoPrices({
        BTC: data.bitcoin?.usd || 85000,
        ETH: data.ethereum?.usd || 2900,
        USDT: data.tether?.usd || 1,
      });
    } catch (error) {
      console.log('Using fallback prices');
    } finally {
      setIsLoading(false);
    }
  };

  const convertCurrency = (value: number, from: string, to: string): string => {
    if (!value) return "0";

    // Convert to USD first
    let usdValue = value;
    if (from !== 'USD') {
      const fromPrice = cryptoPrices[from as keyof CryptoPrices] || 1;
      usdValue = value * fromPrice;
    }

    // Convert from USD to target
    if (to === 'USD') {
      return usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    const toPrice = cryptoPrices[to as keyof CryptoPrices] || 1;
    const result = usdValue / toPrice;
    
    if (to === 'USDT') {
      return result.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return result.toFixed(8);
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    return numericValue;
  };

  const numericAmount = parseFloat(amount) || 0;
  const convertedAmount = convertCurrency(numericAmount, fromCurrency, toCurrency);
  const fromSymbol = currencies.find(c => c.code === fromCurrency)?.symbol || '';
  const toSymbol = currencies.find(c => c.code === toCurrency)?.symbol || '';

  return (
    <div className="mt-6 p-4 rounded-2xl bg-card border border-border animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Currency Converter</h3>
        <button
          onClick={fetchPrices}
          className="p-2 rounded-full hover:bg-secondary"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">From</label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(formatAmount(e.target.value))}
              placeholder="0.00"
              className="flex-1"
            />
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground"
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={swapCurrencies}
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <ArrowRightLeft className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">To</label>
          <div className="flex gap-2">
            <div className="flex-1 px-4 py-2 rounded-lg bg-secondary/50 border border-border flex items-center">
              <span className="text-foreground font-medium">
                {toSymbol}{convertedAmount}
              </span>
            </div>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground"
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 text-center text-xs text-muted-foreground">
          1 BTC = ${cryptoPrices.BTC.toLocaleString()} • 1 ETH = ${cryptoPrices.ETH.toLocaleString()}
        </div>
      </div>
    </div>
  );
};
