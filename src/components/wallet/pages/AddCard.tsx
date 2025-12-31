import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

const cardColors = [
  "wallet-gradient",
  "bg-gradient-to-br from-purple-600 to-pink-500",
  "bg-gradient-to-br from-green-500 to-teal-500",
  "bg-gradient-to-br from-orange-500 to-red-500",
  "bg-gradient-to-br from-gray-700 to-gray-900",
];

const AddCard = () => {
  const { user, isLoading } = useAuth();
  const { addCard } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedColor, setSelectedColor] = useState(cardColors[0]);
  const [isAdding, setIsAdding] = useState(false);

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

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ") : cleaned;
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, "").length <= 16) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.length <= 5) {
      setExpiryDate(formatted);
    }
  };

  const detectCardType = (number: string): 'Visa' | 'Mastercard' => {
    const cleaned = number.replace(/\s/g, "");
    if (cleaned.startsWith("4")) return "Visa";
    if (cleaned.startsWith("5") || cleaned.startsWith("2")) return "Mastercard";
    return "Visa";
  };

  const handleAddCard = () => {
    const cleanedNumber = cardNumber.replace(/\s/g, "");
    
    if (cleanedNumber.length !== 16) {
      toast({ title: "Error", description: "Please enter a valid 16-digit card number", variant: "destructive" });
      return;
    }
    if (!holderName.trim()) {
      toast({ title: "Error", description: "Please enter the card holder name", variant: "destructive" });
      return;
    }
    if (expiryDate.length !== 5) {
      toast({ title: "Error", description: "Please enter a valid expiry date", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    
    addCard({
      type: detectCardType(cardNumber),
      lastFour: cleanedNumber.slice(-4),
      holderName: holderName.trim(),
      expiryDate,
      color: selectedColor,
    });

    toast({ title: "Success", description: "Card added successfully" });
    setIsAdding(false);
    navigate("/cards");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 flex items-center gap-4 animate-fade-in">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Add New Card</h1>
        </div>

        {/* Card Preview */}
        <div 
          className={`${selectedColor} rounded-2xl p-6 text-primary-foreground wallet-shadow mt-8 animate-slide-up`}
        >
          <div className="flex items-start justify-between mb-8">
            <CreditCard className="w-10 h-10" />
            <p className="font-semibold">{detectCardType(cardNumber)}</p>
          </div>
          <p className="text-lg font-mono tracking-wider mb-4">
            {cardNumber || "•••• •••• •••• ••••"}
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs opacity-70">Card Holder</p>
              <p className="font-semibold">{holderName || "YOUR NAME"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70">Expires</p>
              <p className="font-semibold">{expiryDate || "MM/YY"}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              value={cardNumber}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="holderName">Card Holder Name</Label>
            <Input
              id="holderName"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value.toUpperCase())}
              placeholder="JOHN DOE"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">Expiry Date</Label>
            <Input
              id="expiryDate"
              value={expiryDate}
              onChange={handleExpiryChange}
              placeholder="MM/YY"
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label>Card Color</Label>
            <div className="flex gap-3">
              {cardColors.map((color, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg ${color} ${
                    selectedColor === color ? "ring-2 ring-accent ring-offset-2" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={handleAddCard}
          disabled={isAdding}
          className="w-full mt-8 py-6 text-lg animate-slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          <CreditCard className="w-5 h-5 mr-2" />
          {isAdding ? "Adding..." : "Add Card"}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default AddCard;
