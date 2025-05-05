
interface SlackMessageProps {
  sender: string;
  text: string;
  time: string;
  isCurrentUser?: boolean;
}

export default function SlackMessage({ sender, text, time, isCurrentUser = false }: SlackMessageProps) {
  // Generate a consistent avatar color based on sender name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-yellow-500", 
      "bg-purple-500", "bg-pink-500", "bg-indigo-500"
    ];
    
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    
    return colors[sum % colors.length];
  };
  
  // Unfold gets a special avatar
  const avatarClass = sender === "Unfold" 
    ? "bg-gradient-to-r from-unfold-purple to-unfold-teal" 
    : getAvatarColor(sender);
  
  return (
    <div className="flex items-start gap-2 group">
      <div className={`w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0 ${avatarClass}`}>
        {sender.charAt(0).toUpperCase()}
      </div>
      
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{sender}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="mt-1 text-sm">
          {text}
        </div>
      </div>
    </div>
  );
}
