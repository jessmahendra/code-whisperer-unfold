
import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sample chat history data
const SAMPLE_HISTORY = [
  {
    id: "1",
    question: "How does the subscription payment process work in Ghost?",
    timestamp: "2 hours ago",
    isPinned: true
  },
  {
    id: "2",
    question: "What happens when a member's subscription expires?",
    timestamp: "Yesterday",
    isPinned: false
  },
  {
    id: "3",
    question: "Is there a limit to how many posts a publication can have?",
    timestamp: "3 days ago",
    isPinned: true
  },
  {
    id: "4",
    question: "How does Ghost handle premium vs. free content?",
    timestamp: "1 week ago",
    isPinned: false
  }
];

export default function ChatHistory() {
  const [history, setHistory] = useState(SAMPLE_HISTORY);

  const togglePin = (id: string) => {
    setHistory(history.map(item => 
      item.id === id ? { ...item, isPinned: !item.isPinned } : item
    ));
  };

  return (
    <div className="space-y-2">
      {history.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No chat history yet</p>
        </div>
      ) : (
        history.map((item) => (
          <div 
            key={item.id} 
            className="p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors flex justify-between group"
          >
            <div>
              <p className="text-sm font-medium line-clamp-2">{item.question}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.timestamp}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`opacity-0 group-hover:opacity-100 transition-opacity ${item.isPinned ? 'text-amber-500' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePin(item.id);
              }}
            >
              <Star className={`h-4 w-4 ${item.isPinned ? 'fill-amber-500' : ''}`} />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
