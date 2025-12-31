import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Contact {
  id: string;
  name: string;
  avatar?: string;
}

const contacts: Contact[] = [
  { id: "1", name: "Natalia", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
  { id: "2", name: "James", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
  { id: "3", name: "Lucia", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" },
  { id: "4", name: "John", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" },
];

export const SendMoney = () => {
  return (
    <div className="py-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <h2 className="text-lg font-semibold text-foreground mb-4">Send Money</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        <button className="flex flex-col items-center gap-2 flex-shrink-0 group">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-accent group-hover:bg-accent/10 transition-all duration-200 group-active:scale-95">
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-accent" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Send</span>
        </button>
        
        {contacts.map((contact) => (
          <button key={contact.id} className="flex flex-col items-center gap-2 flex-shrink-0 group">
            <Avatar className="w-14 h-14 ring-2 ring-transparent group-hover:ring-accent transition-all duration-200 group-active:scale-95">
              <AvatarImage src={contact.avatar} alt={contact.name} />
              <AvatarFallback className="bg-secondary text-foreground font-medium">
                {contact.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground">{contact.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
