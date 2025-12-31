import { Bell, Grid3X3, X, Check, DollarSign, Sun, Moon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { format } from "date-fns";
import { useTheme } from "@/hooks/useTheme";

export const Header = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between py-4 animate-fade-in relative z-50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg wallet-gradient flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">F</span>
        </div>
        <span className="text-xl font-bold text-primary">FiPay</span>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={toggleTheme}
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5 text-foreground" />
          ) : (
            <Sun className="w-5 h-5 text-foreground" />
          )}
        </button>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors relative"
          >
            <Bell className="w-5 h-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-14 w-[340px] bg-background border border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground text-lg">Notifications</h3>
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-full"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              
              {/* Notifications List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
                      <Bell className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">No notifications</p>
                    <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-4 hover:bg-secondary/50 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                            notif.type === 'money_received' 
                              ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg shadow-green-500/25' 
                              : 'bg-primary/15 text-primary'
                          }`}>
                            {notif.type === 'money_received' ? (
                              <DollarSign className="w-5 h-5" />
                            ) : (
                              <Bell className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm text-foreground">{notif.title}</p>
                                  {!notif.read && (
                                    <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                <p className="text-xs text-muted-foreground/70 mt-2">
                                  {format(new Date(notif.date), 'MMM d, yyyy • h:mm a')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!notif.read && (
                                  <button 
                                    onClick={() => markAsRead(notif.id)}
                                    className="p-1.5 hover:bg-primary/10 rounded-full transition-colors"
                                    title="Mark as read"
                                  >
                                    <Check className="w-4 h-4 text-primary" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => clearNotification(notif.id)}
                                  className="p-1.5 hover:bg-destructive/10 rounded-full transition-colors"
                                  title="Remove"
                                >
                                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};