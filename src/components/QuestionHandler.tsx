
import { useState } from "react";
import AnswerDisplay from "./AnswerDisplay";
import QuestionInput from "./QuestionInput";
import SuggestedQuestions from "./SuggestedQuestions";
import { generateAnswer } from "@/services/answerGenerator";
import { addChatEntry } from "@/services/chatHistoryService";
import NoAnswerFallback from "./NoAnswerFallback";

export default function QuestionHandler({ className }: { className?: string }) {
  const [answers, setAnswers] = useState<Array<{
    question: string;
    answer: any;
    timestamp: string;
  }>>([]);
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
      setError(null);
      
      const answer = await generateAnswer(question);

      // Save to chat history after getting the answer
      if (answer) {
        addChatEntry(question, answer);
        
        // Add the new answer to the beginning of our answers array
        setAnswers(prev => [
          {
            question,
            answer,
            timestamp: new Date().toLocaleString()
          },
          ...prev
        ]);
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

  return (
    <div className={className}>
      {/* Display answers at the top */}
      <div className="space-y-8 mb-8">
        {answers.map((item, index) => (
          <div key={index} className="max-w-3xl mx-auto">
            {error && index === 0 ? (
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
      
      {/* Initial view when no answers yet */}
      {answers.length === 0 && (
        <div className="text-center my-16">
          <h2 className="text-2xl font-semibold mb-2">Ask anything about Ghost CMS</h2>
          <p className="text-muted-foreground mb-8">Get instant answers based on the codebase</p>
        </div>
      )}
      
      {/* Search input at the bottom */}
      <div className={`sticky bottom-4 max-w-2xl mx-auto bg-white/80 backdrop-blur-sm p-4 rounded-lg shadow-sm ${answers.length > 0 ? 'mt-12' : ''}`}>
        <QuestionInput
          onAskQuestion={handleAskQuestion}
          isProcessing={isProcessing}
          centered={answers.length === 0}
        />
        
        {answers.length === 0 && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelectQuestion={handleSelectQuestion}
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
}
