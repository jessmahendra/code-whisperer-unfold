
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
      <div className="flex flex-wrap gap-2 justify-center">
        {questions.map((question, index) => (
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
    </div>
  );
}
