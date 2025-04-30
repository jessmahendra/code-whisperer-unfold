
import { Button } from "@/components/ui/button";

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
  return (
    <div className="mt-6 max-w-3xl mx-auto">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Try asking:</h3>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            className="text-sm text-left border-unfold-purple/30 hover:bg-unfold-soft-bg hover:text-unfold-dark-purple"
            onClick={() => onSelectQuestion(question)}
            disabled={isProcessing}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
