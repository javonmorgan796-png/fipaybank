import { BottomNav } from "@/components/wallet/BottomNav";
import { CreditCard, Plus, Lock, Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate, Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Cards = () => {
  const { user, isLoading } = useAuth();
  const { cards, removeCard } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState<Record<string, boolean>>({});

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

  const toggleBalance = (id: string) => {
    setShowBalance(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRemoveCard = (cardId: string) => {
    removeCard(cardId);
    toast({ title: "Card removed", description: "The card has been removed from your wallet" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground mb-6">My Cards</h1>
        </div>

        <div className="space-y-4">
          {cards.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No cards added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add a card to get started</p>
            </div>
          ) : (
            cards.map((card, index) => (
              <div
                key={card.id}
                className={`${card.color} rounded-2xl p-6 text-primary-foreground wallet-shadow animate-slide-up relative`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <button
                  onClick={() => handleRemoveCard(card.id)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-sm opacity-80">Card Holder</p>
                    <p className="font-bold">{card.holderName}</p>
                  </div>
                  <button
                    onClick={() => toggleBalance(card.id)}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {showBalance[card.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg font-mono tracking-wider">
                      •••• •••• •••• {card.lastFour}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-70">Expires</p>
                    <p className="font-semibold">{card.expiryDate}</p>
                  </div>
                </div>
                <div className="mt-4 text-right">
                  <p className="text-sm font-semibold">{card.type}</p>
                </div>
              </div>
            ))
          )}

          <button 
            onClick={() => navigate('/add-card')}
            className="w-full border-2 border-dashed border-muted-foreground/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-accent hover:bg-accent/5 transition-all animate-slide-up" 
            style={{ animationDelay: '0.2s' }}
          >
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">Add New Card</p>
          </button>
        </div>

        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 bg-card rounded-xl card-shadow flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-accent" />
              </div>
              <span className="font-medium text-foreground">Freeze Card</span>
            </button>
            <button className="p-4 bg-card rounded-xl card-shadow flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-accent" />
              </div>
              <span className="font-medium text-foreground">Card Details</span>
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Cards;
