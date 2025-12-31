import { BottomNav } from "@/components/wallet/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  CreditCard,
  Settings,
  DollarSign,
  X,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import { useState, useRef, useEffect } from "react";

const ADMIN_EMAIL = "javonmorgan796@gmail.com";

const Profile = () => {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const isAdmin = user.email === ADMIN_EMAIL;

  const menuItems = [
    { icon: User, label: "Personal Info", description: "Name, email, phone", path: "/personal-info", isNotification: false },
    { icon: CreditCard, label: "Payment Methods", description: "Cards and accounts", path: "/cards", isNotification: false },
    { icon: Bell, label: "Notifications", description: `${unreadCount > 0 ? `${unreadCount} unread` : 'Alerts and reminders'}`, path: "", isNotification: true },
    { icon: Shield, label: "Security", description: "Password and 2FA", path: "", isNotification: false },
    { icon: Settings, label: "Preferences", description: "Theme and language", path: "", isNotification: false },
    { icon: HelpCircle, label: "Help & Support", description: "FAQ and contact", path: "", isNotification: false },
    ...(isAdmin ? [{ icon: ShieldCheck, label: "Admin Dashboard", description: "Manage users and deposits", path: "/admin", isNotification: false }] : []),
  ];

  const handleMenuClick = (path: string) => {
    if (path) {
      navigate(path);
    }
  };

  const handleLogOut = () => {
    signOut();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="pt-6 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground mb-6">Profile</h1>
        </div>

        <div className="flex flex-col items-center py-6 animate-slide-up">
          <Avatar className="w-24 h-24 ring-4 ring-accent/20">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-foreground mt-4">{user.name}</h2>
          <p className="text-muted-foreground">{user.email}</p>
          <button 
            onClick={() => navigate('/personal-info')}
            className="mt-4 px-6 py-2 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all active:scale-95"
          >
            Edit Profile
          </button>
        </div>

        <div className="space-y-2 mt-4">
          {menuItems.map((item, index) => (
            <div key={item.label} className="relative" ref={item.isNotification ? notificationRef : undefined}>
              <button
                onClick={() => item.isNotification ? setShowNotifications(!showNotifications) : handleMenuClick(item.path)}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-xl card-shadow hover:shadow-md transition-all animate-slide-up"
                style={{ animationDelay: `${(index + 1) * 0.05}s` }}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center relative">
                  <item.icon className="w-5 h-5 text-foreground" />
                  {item.isNotification && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>

              {item.isNotification && showNotifications && (
                <div className="absolute left-0 right-0 mt-2 bg-card rounded-xl shadow-xl border border-border overflow-hidden z-50 animate-fade-in">
                  <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                          className="text-xs text-primary hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <p className="text-muted-foreground text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notification) => (
                        <div 
                          key={notification.id}
                          onClick={(e) => { e.stopPropagation(); if (!notification.read) markAsRead(notification.id); }}
                          className={`p-4 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer ${!notification.read ? 'bg-primary/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                              <DollarSign className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground text-sm truncate">{notification.title}</p>
                                {!notification.read && (
                                  <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs mt-0.5 truncate">{notification.message}</p>
                              <p className="text-muted-foreground/70 text-xs mt-1">
                                {new Date(notification.date).toLocaleDateString()}
                              </p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); clearNotification(notification.id); }}
                              className="p-1 hover:bg-secondary rounded-full"
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button 
          onClick={handleLogOut}
          className="w-full flex items-center justify-center gap-2 p-4 mt-6 text-destructive hover:bg-destructive/10 rounded-xl transition-colors animate-slide-up" 
          style={{ animationDelay: '0.4s' }}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
