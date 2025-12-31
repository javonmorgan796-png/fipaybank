import { ArrowUpRight, ArrowDownLeft, Wallet, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const ActionButton = ({ icon, label, onClick }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 group"
  >
    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 group-active:scale-95">
      {icon}
    </div>
    <span className="text-sm font-medium text-foreground">{label}</span>
  </button>
);

export const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    { icon: <ArrowUpRight className="w-6 h-6" />, label: "Send", path: "/send" },
    { icon: <ArrowDownLeft className="w-6 h-6" />, label: "Receive", path: "/receive" },
    { icon: <Wallet className="w-6 h-6" />, label: "Topup", path: "/topup" },
    { icon: <MoreHorizontal className="w-6 h-6" />, label: "More", path: "" },
  ];

  return (
    <div className="flex justify-center gap-6 md:gap-10 py-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      {actions.map((action) => (
        <ActionButton 
          key={action.label} 
          icon={action.icon} 
          label={action.label}
          onClick={() => action.path && navigate(action.path)}
        />
      ))}
    </div>
  );
};
