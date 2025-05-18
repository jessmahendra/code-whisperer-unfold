
import { useState } from "react";
import QuestionInput from "@/components/QuestionInput";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import AnswerDisplay from "@/components/AnswerDisplay";
import NoAnswerFallback from "@/components/NoAnswerFallback";
import { generateAnswer } from "@/services/answerGenerator";
import { toast } from "@/components/ui/sonner";

// Sample suggested questions
const suggestedQuestions = [
  "How does the subscription payment process work in Ghost?",
  "What happens when a member's subscription expires?",
  "Can members access content after their subscription ends?",
  "Is there a limit to how many posts a publication can have?",
  "How does Ghost handle premium vs. free content?"
];

interface Answer {
  text: string;
  confidence: number;
  references: {
    filePath: string;
    lineNumbers?: string;
    snippet?: string;
    lastUpdated?: string;
  }[];
  visualContext?: {
    type: 'flowchart' | 'component' | 'state';
    syntax: string;
  };
}

interface QuestionHandlerProps {
  isProcessing: boolean;
  isInitializingKB: boolean;
  isAIEnabled: boolean;
}

export default function QuestionHandler({
  isProcessing: externalProcessing,
  isInitializingKB,
  isAIEnabled
}: QuestionHandlerProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAskQuestion = async (query: string) => {
    setQuestion(query);
    setIsProcessing(true);
    // Reset answer when a new question is asked
    setAnswer(null);
    try {
      // Simulate a bit of processing time to show the animation
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = await generateAnswer(query);
      if (result) {
        setAnswer(result);
      } else {
        setAnswer(null);
      }
    } catch (error) {
      console.error("Error generating answer:", error);
      toast.error("Failed to generate answer");
      setAnswer(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectQuestion = (query: string) => {
    handleAskQuestion(query);
  };

  const formatTimestamp = () => {
    const now = new Date();
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(now);
  };

  const combinedIsProcessing = isProcessing || externalProcessing;

  return (
    <div className="text-left">
      <div className="relative">
        <QuestionInput 
          onAskQuestion={handleAskQuestion} 
          isProcessing={combinedIsProcessing || isInitializingKB}
        />
        {isAIEnabled && <div className="absolute -top-5 right-2"></div>}
      </div>

      <SuggestedQuestions 
        questions={suggestedQuestions} 
        onSelectQuestion={handleSelectQuestion} 
        isProcessing={combinedIsProcessing || isInitializingKB}
      />

      {combinedIsProcessing && (
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-background/80 px-4 py-2 rounded-full shadow-sm animate-pulse-slow">
            <div className="h-2 w-2 bg-unfold-purple rounded-full" />
            Processing your question...
          </div>
        </div>
      )}

      {!combinedIsProcessing && question && (
        answer ? (
          <AnswerDisplay
            question={question}
            answer={answer.text}
            confidence={answer.confidence}
            references={answer.references}
            timestamp={formatTimestamp()}
            visualContext={answer.visualContext}
          />
        ) : (
          question && !combinedIsProcessing && <NoAnswerFallback question={question} />
        )
      )}
    </div>
  );
}
