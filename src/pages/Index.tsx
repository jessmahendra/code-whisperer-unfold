import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import QuestionInput from "@/components/QuestionInput";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import AnswerDisplay from "@/components/AnswerDisplay";
import NoAnswerFallback from "@/components/NoAnswerFallback";
import GradientBackground from "@/components/GradientBackground";
import { AIStatusBadge } from "@/components/AIStatusBadge";
import { generateAnswer } from "@/services/answerGenerator";
import { 
  initializeKnowledgeBase, 
  isUsingMockData, 
  getKnowledgeBaseStats, 
  isInitializing 
} from "@/services/knowledgeBase";
import { toast } from "@/components/ui/sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Slack, CodeIcon } from "lucide-react";
import { hasRepositoryConfig } from "@/services/repositoryConfig";
import { isGithubClientInitialized, initGithubClient } from "@/services/githubClient";
import { getConnectionDiagnostics } from "@/services/githubConnector";
import { getExplorationProgress } from "@/services/knowledgeBase/pathExplorer";
import RepositoryProgressIndicator from "@/components/RepositoryProgressIndicator";
import { hasAICapabilities, wasAPIKeyPreviouslySet } from "@/services/aiAnalysis";

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

export default function Index() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializingKB, setIsInitializingKB] = useState(true);
  const [hasRepo, setHasRepo] = useState(hasRepositoryConfig());
  const [isConnected, setIsConnected] = useState(false);
  const [usingMockData, setUsingMockData] = useState(true);
  const [knowledgeStats, setKnowledgeStats] = useState<ReturnType<typeof getKnowledgeBaseStats> | null>(null);
  const [bannerKey, setBannerKey] = useState(0); // Key to force re-render of banners
  const [explorationStatus, setExplorationStatus] = useState<"idle" | "exploring" | "complete" | "error">("idle");
  const [showProgressIndicator, setShowProgressIndicator] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(hasAICapabilities());

  // Function to update connection status - extracted to avoid repetition
  const updateConnectionStatus = useCallback(() => {
    // Check if repository configuration exists and GitHub client is initialized
    const hasConfig = hasRepositoryConfig();
    const isClientInitialized = isGithubClientInitialized();
    const diagnostics = getConnectionDiagnostics();
    const progress = getExplorationProgress();
    
    // Get the latest stats to determine if we're using real data
    const stats = getKnowledgeBaseStats();
    
    // Update status states
    setKnowledgeStats(stats);
    setExplorationStatus(progress.status);
    setHasRepo(hasConfig);
    setIsConnected(hasConfig && isClientInitialized);
    
    // Check if we're actually using mock data or real data
    // We consider truly connected if we have processed files > 0
    const actuallyUsingMock = isUsingMockData() || stats.processedFiles === 0;
    setUsingMockData(actuallyUsingMock);
    
    // Show progress indicator when exploring
    setShowProgressIndicator(progress.status === "exploring");
    
    // Check initialization status
    if (isInitializing() || progress.status === "exploring") {
      setIsInitializingKB(true);
    } else {
      setIsInitializingKB(false);
    }
    
    // Force banner refresh
    setBannerKey(prevKey => prevKey + 1);
    
    return { 
      hasConfig, 
      isClientInitialized, 
      actuallyUsingMock, 
      stats, 
      diagnostics, 
      progress 
    };
  }, []);

  // Initialize knowledge base on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Auto-reconnect to GitHub if we have a config
        const config = hasRepositoryConfig();
        if (config) {
          console.log("Found existing repository configuration, attempting to reconnect...");
          const repoConfig = getRepositoryConfig();
          
          if (repoConfig && repoConfig.token) {
            // Re-initialize GitHub client with the stored token
            const initialized = initGithubClient(repoConfig.token);
            if (initialized) {
              console.log("Successfully reconnected to GitHub with stored token");
              toast.success("Reconnected to GitHub repository");
            }
          }
        }
        
        // Initialize the knowledge base
        await initializeKnowledgeBase();
        
        // Update connection status
        updateConnectionStatus();
        
        // Check if API key was previously set and notify the user
        if (wasAPIKeyPreviouslySet() && !hasAICapabilities()) {
          toast.info("OpenAI API key needed", {
            description: "You previously used AI features. Please re-enter your OpenAI API key.",
            duration: 5000
          });
        }
        
      } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
        toast.error("Failed to initialize knowledge base");
      } finally {
        // Final status update
        updateConnectionStatus();
      }
    };
    
    initialize();
    
    // Poll for updates more frequently (300ms instead of 500ms)
    const intervalId = setInterval(() => {
      updateConnectionStatus();
      // Check if AI is enabled
      setIsAIEnabled(hasAICapabilities());
    }, 300);
    
    return () => clearInterval(intervalId);
  }, [updateConnectionStatus]);

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

  const openConfigModal = () => {
    // Find and click the config button in the header
    const configButton = document.querySelector('header button') as HTMLButtonElement;
    if (configButton) {
      configButton.click();
    }
  };

  // Determine if we should show the banner - consider exploration status
  const shouldShowWarningBanner = (!isConnected || usingMockData) && 
                                  explorationStatus !== "exploring" &&
                                  !showProgressIndicator;
                                  
  // We're removing the success banner completely, so no need for this variable anymore
  // const shouldShowSuccessBanner = false;

  return <GradientBackground>
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container py-8">
          <section className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
              Unfold
            </h1>
            <p className="text-xl mb-8">
              Instant answers to your Ghost product questions, extracted directly from code.
            </p>
            
            {/* Use key to force re-render of banners when status changes */}
            <div key={bannerKey}>
              {showProgressIndicator && <RepositoryProgressIndicator />}
              
              {shouldShowWarningBanner && (
                <div className="mb-6 p-4 border border-yellow-200 bg-yellow-50 rounded-lg text-left">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
                    <div>
                      <h3 className="font-medium text-yellow-800">
                        {!isConnected ? "Using mock data" : "Connected but using mock data"}
                      </h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        {!isConnected ? 
                          "You're currently using mock data. To connect to the Ghost GitHub repository, click the button below." : 
                          "You've connected to GitHub but we're still using mock data. This might happen if the repository structure doesn't match our expectations or if your token lacks permissions."
                        }
                      </p>
                      <div className="mt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-white" 
                          onClick={openConfigModal}
                        >
                          <CodeIcon className="h-4 w-4 mr-1" />
                          {!isConnected ? "Configure GitHub Connection" : "Check GitHub Connection"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Removing the success banner completely */}
            </div>
            
            <div className="relative">
              <QuestionInput onAskQuestion={handleAskQuestion} isProcessing={isProcessing || isInitializingKB} />
              {isAIEnabled && (
                <div className="absolute -top-5 right-2">
                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    AI Enabled
                  </span>
                </div>
              )}
            </div>
            
            <SuggestedQuestions questions={suggestedQuestions} onSelectQuestion={handleSelectQuestion} isProcessing={isProcessing || isInitializingKB} />
          </section>
          
          {isProcessing && <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-background/80 px-4 py-2 rounded-full shadow-sm animate-pulse-slow">
                <div className="h-2 w-2 bg-unfold-purple rounded-full" />
                Processing your question...
              </div>
            </div>}
          
          {!isProcessing && question && (answer ? <AnswerDisplay question={question} answer={answer.text} confidence={answer.confidence} references={answer.references} timestamp={formatTimestamp()} visualContext={answer.visualContext} /> : question && !isProcessing && <NoAnswerFallback question={question} />)}
        </main>
        
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <div className="container relative">
            <div className="text-center">
              <p>Currently using {usingMockData ? 'mock' : 'repository'} data for knowledge base</p>
              {isAIEnabled && <p className="text-green-600 text-xs mt-1">AI-powered answers enabled</p>}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              asChild 
              className="absolute bottom-0 right-0 hover:bg-slate-100"
            >
              <Link to="/slack-demo">
                <Slack className="h-5 w-5 text-slate-600" />
              </Link>
            </Button>
          </div>
        </footer>
      </div>
    </GradientBackground>;
}
