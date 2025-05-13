
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onStartChat: () => void;
}

export default function EmptyState({ onStartChat }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <BookOpen className="h-16 w-16 text-unfold-purple mb-6" />
      <h1 className="text-2xl font-bold mb-3">Welcome to Unfold</h1>
      <p className="text-muted-foreground mb-6">
        Get instant answers to your Ghost product questions, extracted directly from code.
        Pin topics and questions for quick access later.
      </p>
      <Button 
        className="bg-gradient-to-r from-unfold-purple to-unfold-teal hover:opacity-90"
        size="lg"
        onClick={onStartChat}
      >
        Start New Chat
      </Button>
      
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <div className="border rounded-lg p-4 text-left">
          <h3 className="font-medium mb-2">Ask Questions</h3>
          <p className="text-sm text-muted-foreground">Get detailed answers about Ghost's features and functionality</p>
        </div>
        <div className="border rounded-lg p-4 text-left">
          <h3 className="font-medium mb-2">Pin Topics</h3>
          <p className="text-sm text-muted-foreground">Save important information for quick reference</p>
        </div>
      </div>
    </div>
  );
}
