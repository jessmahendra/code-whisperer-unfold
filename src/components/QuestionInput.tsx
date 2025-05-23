
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import QuestionAutoComplete from "./QuestionAutoComplete";

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

  const handleSelectQuestion = (selectedQuestion: string) => {
    // Auto-submit when user selects from suggestions
    if (selectedQuestion.trim()) {
      onAskQuestion(selectedQuestion);
      setQuestion("");
    }
  };

  const handleEmptyButtonClick = () => {
    if (!question.trim()) {
      toast.error("Please enter a question");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${centered ? "max-w-2xl mx-auto text-center" : ""}`}>
      <div className="relative">
        <div className={`${centered ? "py-6 text-base" : "pl-4 pr-24 py-5"} border border-input rounded-md shadow-sm focus-within:ring-2 focus-within:ring-sky-900`}>
          <QuestionAutoComplete
            value={question}
            onChange={setQuestion}
            onSelect={handleSelectQuestion}
            placeholder={centered ? "What do you want to know today?" : "Ask another question..."}
            disabled={isProcessing}
            className="w-full"
          />
        </div>
        <Button 
          type="submit"
          className={`${centered ? "mt-4" : "absolute right-1 top-1/2 -translate-y-1/2"} bg-sky-900 hover:bg-sky-800 border-sky-900`}
          disabled={isProcessing}
          variant="default"
          style={{ backgroundColor: "#0c4a6e" }}
          onClick={!question.trim() ? handleEmptyButtonClick : undefined}
        >
          {isProcessing ? "Processing..." : centered ? "Search" : "Ask"}
          {centered && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
