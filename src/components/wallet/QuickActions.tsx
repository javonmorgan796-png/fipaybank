import { ArrowUpRight, ArrowDownLeft, Wallet, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

const ActionButton = ({ icon, label, onClick, disabled }: ActionButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center group-hover:from-primary group-hover:to-primary/90 group-active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl dark:shadow-primary/30">
      <div className="text-primary-foreground group-hover:scale-110 transition-transform">
        {icon}
      </div>
    </div>
    <span className="text-sm font-semibold text-foreground dark:text-white">{label}</span>
  </button>
);

export const QuickActions = ({ disabled = false }: { disabled?: boolean }) => {
  const navigate = useNavigate();

  const actions = [
    { icon: <ArrowUpRight className="w-7 h-7" />, label: "Send", path: "/send" },
    { icon: <ArrowDownLeft className="w-7 h-7" />, label: "Receive", path: "/receive" },
    { icon: <Wallet className="w-7 h-7" />, label: "Topup", path: "/topup" },
    { icon: <MoreHorizontal className="w-7 h-7" />, label: "More", path: "" },
  ];

  return (
    <div className="flex justify-center gap-6 md:gap-10 py-8 animate-slide-up px-2" style={{ animationDelay: '0.1s' }}>
      {actions.map((action) => (
        <ActionButton 
          key={action.label} 
          icon={action.icon} 
          label={action.label}
          disabled={disabled}
          onClick={() => !disabled && action.path && navigate(action.path)}
        />
      ))}
    </div>
  );
};
