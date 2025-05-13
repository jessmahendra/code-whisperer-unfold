
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

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
          <Card key={topic.id} className="cursor-pointer hover:border-unfold-purple transition-colors">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs">
                {topic.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1 px-3 pb-2">
              <p className="text-xs text-muted-foreground mb-1">{topic.description}</p>
              <ul className="text-[10px] space-y-0.5">
                {topic.items.map((item, i) => (
                  <li key={i} className="truncate hover:text-unfold-purple">{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
