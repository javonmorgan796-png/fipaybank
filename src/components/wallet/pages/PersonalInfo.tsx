import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/wallet/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

const PersonalInfo = () => {
  const { user, isLoading, updateProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    setIsSaving(true);
    updateProfile({ name, phone, avatar });
    toast({ title: "Success", description: "Profile updated successfully" });
    setIsSaving(false);
    navigate("/profile");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 flex items-center gap-4 animate-fade-in">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Personal Info</h1>
        </div>

        <div className="mt-8 flex flex-col items-center animate-slide-up">
          <div className="relative">
            <Avatar className="w-24 h-24 ring-4 ring-accent/20">
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 p-2 bg-accent rounded-full cursor-pointer hover:brightness-110 transition-all">
              <Camera className="w-4 h-4 text-accent-foreground" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-8 space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="space-y-2">
            <Label>Country</Label>
            <Input
              value={`${user.countryFlag || ''} ${user.countryCode || ''} ${user.countryName || ''}`}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full mt-8 py-6 text-lg animate-slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default PersonalInfo;
