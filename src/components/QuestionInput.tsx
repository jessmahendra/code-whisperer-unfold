
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface QuestionInputProps {
  onAskQuestion: (question: string) => void;
  isProcessing: boolean;
}

export default function QuestionInput({
  onAskQuestion,
  isProcessing
}: QuestionInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }
    onAskQuestion(question);
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          className="pl-10 pr-24 py-6 text-base shadow-md focus-visible:ring-unfold-purple"
          placeholder="Ask about Ghost's functionality..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isProcessing}
        />
        <Button 
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-gradient-to-r from-unfold-purple to-unfold-teal hover:opacity-90"
          disabled={isProcessing || !question.trim()}
        >
          {isProcessing ? "Processing..." : "Ask"}
        </Button>
      </div>
    </form>
  );
}
