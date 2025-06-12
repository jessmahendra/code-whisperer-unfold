import { useState, useRef, useEffect } from "react";
import AnswerDisplay from "./AnswerDisplay";
import QuestionInput from "./QuestionInput";
import SuggestedQuestions from "./SuggestedQuestions";
import ShareSessionButton from "./ShareSessionButton";
import { generateAnswer } from "@/services/answerGenerator";
import { addChatEntry } from "@/services/chatHistoryService";
import NoAnswerFallback from "./NoAnswerFallback";
import { getCurrentRepository } from "@/services/githubConnector";
import { initializeKnowledgeBase, isUsingMockData, getEnhancedDiagnostics } from "@/services/knowledgeBase";

export default function QuestionHandler({
  className
}: {
  className?: string;
}) {
  const [answers, setAnswers] = useState<Array<{
    question: string;
    answer: any;
    timestamp: string;
    hasError?: boolean;
  }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRepo, setCurrentRepo] = useState<{ owner: string; repo: string } | null>(null);
  
  // Create a ref for the most recent answer to scroll to
  const latestAnswerRef = useRef<HTMLDivElement>(null);
  
  // Update repository info and check knowledge base status
  useEffect(() => {
    const repo = getCurrentRepository();
    setCurrentRepo(repo);
    
    // Check if we're using mock data and log diagnostics
    const usingMock = isUsingMockData();
    const diagnostics = getEnhancedDiagnostics();
    
    console.log("QuestionHandler diagnostics:", {
      repository: repo,
      usingMockData: usingMock,
      knowledgeBaseSize: diagnostics.knowledgeBaseSize,
      scannedFiles: diagnostics.lastScanDiagnostics.scannedFiles.length,
      initState: diagnostics.initializationState
    });
    
    // If we have a repository but are still using mock data, try to reinitialize
    if (repo && usingMock && diagnostics.knowledgeBaseSize <= 50) {
      console.log("Repository detected but using mock data, attempting to reinitialize knowledge base");
      initializeKnowledgeBase(true).then(() => {
        const newDiagnostics = getEnhancedDiagnostics();
        console.log("After reinitialization:", {
          usingMockData: isUsingMockData(),
          knowledgeBaseSize: newDiagnostics.knowledgeBaseSize,
          scannedFiles: newDiagnostics.lastScanDiagnostics.scannedFiles.length
        });
      });
    }
  }, []);

  // Generate dynamic content based on repository
  const getHeading = () => {
    if (currentRepo) {
      return `Ask anything about ${currentRepo.repo}`;
    }
    return "Ask anything about Ghost";
  };

  const getSubheading = () => {
    if (currentRepo) {
      return `Get instant answers based on the ${currentRepo.owner}/${currentRepo.repo} codebase`;
    }
    return "Get instant answers based on the codebase";
  };

  const getSuggestedQuestions = () => {
    if (currentRepo) {
      const repoName = currentRepo.repo;
      return [
        `How does ${repoName} handle authentication?`,
        `What is the main architecture of ${repoName}?`,
        `How can I contribute to ${repoName}?`
      ];
    }
    return [
      "How does Ghost handle image uploads?",
      "What is the difference between a post and a page in Ghost?",
      "How can I integrate Ghost with other services?"
    ];
  };
  
  const handleAskQuestion = async (question: string) => {
    try {
      setIsProcessing(true);
      
      console.log(`Processing question: "${question}"`);
      
      // Log current knowledge base status before generating answer
      const preDiagnostics = getEnhancedDiagnostics();
      console.log("Pre-answer diagnostics:", {
        usingMockData: isUsingMockData(),
        knowledgeBaseSize: preDiagnostics.knowledgeBaseSize,
        repository: getCurrentRepository()
      });
      
      // Detect if it's a how-to question to modify the prompt approach
      const isHowToQuestion = question.toLowerCase().includes("how to") || 
                             question.toLowerCase().startsWith("how do") ||
                             question.toLowerCase().startsWith("how can") ||
                             question.toLowerCase().startsWith("how should");
      
      // Pass this context to the answer generator
      const answer = await generateAnswer(question, { 
        concise: isHowToQuestion,
        skipBenefits: isHowToQuestion
      });

      console.log(`Answer received:`, answer ? 'Success' : 'No answer');

      if (answer) {
        // Save to chat history after getting the answer
        addChatEntry(question, answer);

        // Add the new answer to the END of our answers array to maintain oldest-to-newest ordering
        setAnswers(prev => [...prev, {
          question,
          answer,
          timestamp: new Date().toLocaleString(),
          hasError: false
        }]);
        
        console.log(`Answer added to display for question: "${question}"`);
      } else {
        // Add error answer to display
        console.log(`No answer found for question: "${question}"`);
        setAnswers(prev => [...prev, {
          question,
          answer: null,
          timestamp: new Date().toLocaleString(),
          hasError: true
        }]);
      }
    } catch (error) {
      console.error("Error processing question:", error);
      
      // Add error answer to display
      setAnswers(prev => [...prev, {
        question,
        answer: null,
        timestamp: new Date().toLocaleString(),
        hasError: true
      }]);
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
          <ShareSessionButton answers={answers.filter(a => !a.hasError)} />
        </div>
      )}

      {/* Initial view when no answers yet - search is at the top */}
      {!hasAnswers && (
        <div className="my-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-2 text-center">{getHeading()}</h2>
          <p className="text-muted-foreground mb-8 text-center">{getSubheading()}</p>
          <QuestionInput onAskQuestion={handleAskQuestion} isProcessing={isProcessing} centered={true} />
          <SuggestedQuestions questions={getSuggestedQuestions()} onSelectQuestion={handleSelectQuestion} isProcessing={isProcessing} />
        </div>
      )}

      {/* Display answers - only when we have answers */}
      {hasAnswers && (
        <div>
          <div className="space-y-8 mb-8">
            {answers.map((item, index) => (
              <div key={index} className="max-w-3xl mx-auto" ref={index === answers.length - 1 ? latestAnswerRef : null}>
                {item.hasError || !item.answer ? (
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
