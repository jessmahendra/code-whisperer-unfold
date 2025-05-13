import { useState, useEffect } from "react";
import { toast } from "sonner";
import Header from "@/components/Header";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import QuestionInput from "@/components/QuestionInput";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import AnswerDisplay from "@/components/AnswerDisplay";
import NoAnswerFallback from "@/components/NoAnswerFallback";
import { generateAnswer } from "@/services/answerGenerator";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";

// Sample suggested questions
const suggestedQuestions = ["How does the subscription payment process work in Ghost?", "What happens when a member's subscription expires?", "Can members access content after their subscription ends?", "Is there a limit to how many posts a publication can have?", "How does Ghost handle premium vs. free content?"];

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

export default function Index() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize knowledge base on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeKnowledgeBase();
      } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
        toast.error("Failed to initialize knowledge base");
      } finally {
        setIsInitializing(false);
      }
    };
    initialize();
  }, []);

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

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <DashboardLayout>
        <div className="container py-8">
          <section className="max-w-3xl mx-auto mb-12">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-medium mb-1 text-gray-900">
                Hey Jane! 👋
              </h1>
              <p className="text-gray-600">Start a conversation...</p>
            </div>
            
            <QuestionInput onAskQuestion={handleAskQuestion} isProcessing={isProcessing || isInitializing} />
            
            <SuggestedQuestions questions={suggestedQuestions} onSelectQuestion={handleSelectQuestion} isProcessing={isProcessing || isInitializing} />
          </section>
          
          {isProcessing && (
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-full shadow-sm animate-pulse-slow">
                <div className="h-2 w-2 bg-gray-400 rounded-full" />
                Processing your question...
              </div>
            </div>
          )}
          
          {!isProcessing && question && (
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
              question && !isProcessing && <NoAnswerFallback question={question} />
            )
          )}
        </div>
      </DashboardLayout>
    </div>
  );
}
