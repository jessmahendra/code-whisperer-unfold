
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
    <div className="space-y-4">
      {topics.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No pinned topics yet</p>
          <p className="text-sm text-muted-foreground mt-1">Star messages to pin them here</p>
        </div>
      ) : (
        topics.map((topic) => (
          <Card key={topic.id} className="cursor-pointer hover:border-unfold-purple transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Star className="h-4 w-4 mr-1 fill-amber-500 text-amber-500" />
                {topic.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">{topic.description}</p>
              <ul className="text-xs space-y-1">
                {topic.items.map((item, i) => (
                  <li key={i} className="truncate hover:text-unfold-purple">• {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
