import { Home, BarChart3, CreditCard, User, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  isActive: boolean;
}

const NavItem = ({ icon, label, to, isActive }: NavItemProps) => (
  <Link
    to={to}
    className={`flex flex-col items-center gap-1 py-2 px-4 transition-colors ${
      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    {icon}
    <span className="text-xs font-medium">{label}</span>
  </Link>
);

export const BottomNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card nav-shadow border-t border-border z-50">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        <NavItem
          icon={<Home className="w-5 h-5" />}
          label="Home"
          to="/"
          isActive={currentPath === '/'}
        />
        <NavItem
          icon={<BarChart3 className="w-5 h-5" />}
          label="Stats"
          to="/stats"
          isActive={currentPath === '/stats'}
        />
        
        {/* Center Action Button */}
        <div className="relative -top-5">
          <button className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center wallet-shadow hover:brightness-110 transition-all active:scale-95">
            <Plus className="w-6 h-6" />
          </button>
        </div>
        
        <NavItem
          icon={<CreditCard className="w-5 h-5" />}
          label="My Cards"
          to="/cards"
          isActive={currentPath === '/cards'}
        />
        <NavItem
          icon={<User className="w-5 h-5" />}
          label="Profile"
          to="/profile"
          isActive={currentPath === '/profile'}
        />
      </div>
    </nav>
  );
};
