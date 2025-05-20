
import { useState } from "react";
import AnswerDisplay from "./AnswerDisplay";
import QuestionInput from "./QuestionInput";
import SuggestedQuestions from "./SuggestedQuestions";
import { generateAnswer } from "@/services/answerGenerator";
import { addChatEntry } from "@/services/chatHistoryService";
import NoAnswerFallback from "./NoAnswerFallback";

export default function QuestionHandler({ className }: { className?: string }) {
  const [lastAnswer, setLastAnswer] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedQuestions = [
    "How does Ghost handle image uploads?",
    "What is the difference between a post and a page in Ghost?",
    "How can I integrate Ghost with other services?",
  ];

  const handleAskQuestion = async (question: string) => {
    try {
      setIsProcessing(true);
      setCurrentQuestion(question);
      setError(null);
      
      const answer = await generateAnswer(question);

      // Save to chat history after getting the answer
      if (answer) {
        addChatEntry(question, answer);
      }
      
      setLastAnswer(answer);
      
      if (!answer) {
        setError("I couldn't find information related to your question.");
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

  return (
    <div className={className}>
      <QuestionInput
        onAskQuestion={handleAskQuestion}
        isProcessing={isProcessing}
        centered
      />
      <SuggestedQuestions
        questions={suggestedQuestions}
        onSelectQuestion={handleSelectQuestion}
        isProcessing={isProcessing}
      />
      {lastAnswer && currentQuestion && (
        <div className="mt-8 max-w-3xl mx-auto">
          {error ? (
            <NoAnswerFallback question={currentQuestion} />
          ) : (
            <AnswerDisplay 
              question={currentQuestion}
              answer={lastAnswer.answer}
              confidence={lastAnswer.confidence}
              references={lastAnswer.references}
              timestamp={new Date().toLocaleString()}
            />
          )}
        </div>
      )}
    </div>
  );
}
