
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sample pinned topics
const SAMPLE_TOPICS = [
  {
    id: "1",
    title: "Subscriptions",
    description: "How Ghost handles member subscriptions",
    items: [
      "How does the subscription payment process work?",
      "What happens when a subscription expires?",
      "Can members access content after subscription ends?"
    ]
  },
  {
    id: "2",
    title: "Content Limits",
    description: "Post limits and content management",
    items: [
      "Is there a limit to how many posts a publication can have?",
      "How does Ghost handle premium vs. free content?"
    ]
  }
];

export default function PinnedTopics() {
  const [topics, setTopics] = useState(SAMPLE_TOPICS);

  return (
    <div className="space-y-2">
      {topics.length === 0 ? (
        <div className="text-center text-muted-foreground py-4">
          <Star className="h-6 w-6 mx-auto mb-1 opacity-50" />
          <p className="text-sm">No pinned topics yet</p>
          <p className="text-xs text-muted-foreground">Star messages to pin them here</p>
        </div>
      ) : (
        topics.map((topic) => (
          <div 
            key={topic.id} 
            className="p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <p className="text-sm font-medium">{topic.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{topic.description}</p>
          </div>
        ))
      )}
    </div>
  );
}
