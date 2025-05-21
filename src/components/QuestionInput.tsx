
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface QuestionInputProps {
  onAskQuestion: (question: string) => void;
  isProcessing: boolean;
  centered?: boolean;
}

export default function QuestionInput({
  onAskQuestion,
  isProcessing,
  centered = false
}: QuestionInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }
    onAskQuestion(question);
    setQuestion(""); // Clear input after submitting
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${centered ? "max-w-2xl mx-auto text-center" : ""}`}>
      <div className="relative">
        <Input
          className={`${centered ? "py-6 text-base" : "pl-4 pr-24 py-5"} shadow-sm focus-visible:ring-sky-900`}
          placeholder={centered ? "What do you want to know today?" : "Ask another question..."}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isProcessing}
        />
        <Button 
          type="submit"
          className={`${centered ? "mt-4" : "absolute right-1 top-1/2 -translate-y-1/2"} bg-sky-900 hover:bg-sky-800 border-sky-900`}
          disabled={isProcessing || !question.trim()}
        >
          {isProcessing ? "Processing..." : centered ? "Search" : "Ask"}
          {centered && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
