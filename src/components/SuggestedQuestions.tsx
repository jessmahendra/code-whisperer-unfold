
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getFrequentQuestions } from "@/services/chatHistoryService";

interface SuggestedQuestionsProps {
  questions: string[];
  onSelectQuestion: (question: string) => void;
  isProcessing: boolean;
}

export default function SuggestedQuestions({
  questions,
  onSelectQuestion,
  isProcessing
}: SuggestedQuestionsProps) {
  const [frequentQuestions, setFrequentQuestions] = useState<string[]>([]);

  useEffect(() => {
    // Get frequently asked questions from history
    const frequent = getFrequentQuestions(3).map(pattern => pattern.question);
    setFrequentQuestions(frequent);
  }, []);

  // Combine predefined questions with frequent questions, avoiding duplicates
  const allQuestions = [...questions];
  frequentQuestions.forEach(fq => {
    if (!allQuestions.some(q => q.toLowerCase() === fq.toLowerCase())) {
      allQuestions.push(fq);
    }
  });

  // Limit to 6 total suggestions
  const displayQuestions = allQuestions.slice(0, 6);

  return (
    <div className="mt-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap gap-2 justify-center">
        {displayQuestions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            className="text-sm rounded-full border-gray-300 hover:bg-gray-100 hover:text-gray-900"
            onClick={() => onSelectQuestion(question)}
            disabled={isProcessing}
          >
            {question}
          </Button>
        ))}
      </div>
      {frequentQuestions.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Suggestions include your frequently asked questions
        </p>
      )}
    </div>
  );
}
