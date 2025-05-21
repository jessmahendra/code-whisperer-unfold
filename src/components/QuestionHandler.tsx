
import { useState, useRef, useEffect } from "react";
import AnswerDisplay from "./AnswerDisplay";
import QuestionInput from "./QuestionInput";
import SuggestedQuestions from "./SuggestedQuestions";
import ShareSessionButton from "./ShareSessionButton";
import { generateAnswer } from "@/services/answerGenerator";
import { addChatEntry } from "@/services/chatHistoryService";
import NoAnswerFallback from "./NoAnswerFallback";

export default function QuestionHandler({
  className
}: {
  className?: string;
}) {
  const [answers, setAnswers] = useState<Array<{
    question: string;
    answer: any;
    timestamp: string;
  }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Create a ref for the most recent answer to scroll to
  const latestAnswerRef = useRef<HTMLDivElement>(null);
  const suggestedQuestions = ["How does Ghost handle image uploads?", "What is the difference between a post and a page in Ghost?", "How can I integrate Ghost with other services?"];
  const handleAskQuestion = async (question: string) => {
    try {
      setIsProcessing(true);
      setError(null);
      const answer = await generateAnswer(question);

      // Save to chat history after getting the answer
      if (answer) {
        addChatEntry(question, answer);

        // Add the new answer to the END of our answers array to maintain oldest-to-newest ordering
        setAnswers(prev => [...prev, {
          question,
          answer,
          timestamp: new Date().toLocaleString()
        }]);
      } else {
        setError(`I couldn't find information related to "${question}".`);
      }
    } catch (error) {
      console.error("Error processing question:", error);
      setError(`Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleSelectQuestion = (question: string) => {
    handleAskQuestion(question);
  };

  // Effect to scroll to the most recent answer when it's added
  useEffect(() => {
    if (latestAnswerRef.current && answers.length > 0) {
      latestAnswerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [answers.length]);

  // Determine the layout based on whether we have answers or not
  const hasAnswers = answers.length > 0;
  
  return (
    <div className={`relative ${className}`}>
      {/* Header with share button - only show when there are answers */}
      {hasAnswers && (
        <div className="flex justify-end mb-6">
          <ShareSessionButton answers={answers} />
        </div>
      )}

      {/* Initial view when no answers yet - search is at the top */}
      {!hasAnswers && (
        <div className="my-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-2 text-center">Ask anything about Ghost</h2>
          <p className="text-muted-foreground mb-8 text-center">Get instant answers based on the codebase</p>
          <QuestionInput onAskQuestion={handleAskQuestion} isProcessing={isProcessing} centered={true} />
          <SuggestedQuestions questions={suggestedQuestions} onSelectQuestion={handleSelectQuestion} isProcessing={isProcessing} />
        </div>
      )}

      {/* Display answers - only when we have answers */}
      {hasAnswers && (
        <div>
          <div className="space-y-8 mb-8">
            {answers.map((item, index) => (
              <div key={index} className="max-w-3xl mx-auto" ref={index === answers.length - 1 ? latestAnswerRef : null}>
                {error && index === answers.length - 1 ? (
                  <NoAnswerFallback question={item.question} />
                ) : (
                  <AnswerDisplay 
                    question={item.question} 
                    answer={item.answer} 
                    confidence={item.answer.confidence} 
                    references={item.answer.references} 
                    timestamp={item.timestamp} 
                  />
                )}
              </div>
            ))}
          </div>

          {/* Search input at the bottom - only when we have answers */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-md py-4 z-10">
            <div className="max-w-2xl mx-auto px-4">
              <QuestionInput onAskQuestion={handleAskQuestion} isProcessing={isProcessing} centered={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
