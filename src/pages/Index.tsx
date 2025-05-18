
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import QuestionInput from "@/components/QuestionInput";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import AnswerDisplay from "@/components/AnswerDisplay";
import NoAnswerFallback from "@/components/NoAnswerFallback";
import GradientBackground from "@/components/GradientBackground";
import { generateAnswer } from "@/services/answerGenerator";
import { initializeKnowledgeBase, isUsingMockData, getKnowledgeBaseStats, isInitializing } from "@/services/knowledgeBase";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Slack, CodeIcon } from "lucide-react";
import { hasRepositoryConfig } from "@/services/repositoryConfig";
import { isGithubClientInitialized } from "@/services/githubClient";
import { getConnectionDiagnostics } from "@/services/githubConnector";

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
  const [isInitializingKB, setIsInitializingKB] = useState(true);
  const [hasRepo, setHasRepo] = useState(hasRepositoryConfig());
  const [isConnected, setIsConnected] = useState(false);
  const [usingMockData, setUsingMockData] = useState(true);
  const [knowledgeStats, setKnowledgeStats] = useState<ReturnType<typeof getKnowledgeBaseStats> | null>(null);
  const [bannerKey, setBannerKey] = useState(0); // Add a key to force re-render of banners

  // Initialize knowledge base on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize the knowledge base
        await initializeKnowledgeBase();
        
        // Check if repository configuration exists and GitHub client is initialized
        const hasConfig = hasRepositoryConfig();
        const isClientInitialized = isGithubClientInitialized();
        const diagnostics = getConnectionDiagnostics();
        
        // Get the latest stats to determine if we're using real data
        const stats = getKnowledgeBaseStats();
        setKnowledgeStats(stats);
        
        // Update connection status
        setHasRepo(hasConfig);
        setIsConnected(hasConfig && isClientInitialized);
        
        // Check if we're actually using mock data or real data
        // We consider truly connected if we have processed files > 0
        const actuallyUsingMock = isUsingMockData() || stats.processedFiles === 0;
        setUsingMockData(actuallyUsingMock);
        
        console.log("Connection status:", {
          hasConfig,
          isClientInitialized,
          actuallyUsingMock,
          diagnostics,
          stats
        });
        
        // Force banner re-render
        setBannerKey(prev => prev + 1);
      } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
        toast.error("Failed to initialize knowledge base");
      } finally {
        setIsInitializingKB(false);
      }
    };
    
    initialize();
    
    // Poll for updates in case the connection status changes
    const intervalId = setInterval(() => {
      if (isInitializing()) {
        // Still initializing, don't update yet
        setIsInitializingKB(true);
        return;
      } else if (isInitializingKB) {
        // Just finished initializing, update everything
        setIsInitializingKB(false);
        const stats = getKnowledgeBaseStats();
        setKnowledgeStats(stats);
        const mockStatus = isUsingMockData() || stats.processedFiles === 0;
        setUsingMockData(mockStatus);
        setIsConnected(hasRepositoryConfig() && isGithubClientInitialized());
        // Force banner re-render
        setBannerKey(prev => prev + 1);
      }
      
      // Periodically check connection status even after initialization
      const stats = getKnowledgeBaseStats();
      const mockStatus = isUsingMockData() || stats.processedFiles === 0;
      if (mockStatus !== usingMockData) {
        setUsingMockData(mockStatus);
        setKnowledgeStats(stats);
        // Force banner re-render when mock data status changes
        setBannerKey(prev => prev + 1);
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
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

  const openConfigModal = () => {
    // Find and click the config button in the header
    const configButton = document.querySelector('header button') as HTMLButtonElement;
    if (configButton) {
      configButton.click();
    }
  };

  // Determine if we should show the banner
  const shouldShowWarningBanner = !isConnected || usingMockData;
  const shouldShowSuccessBanner = isConnected && !usingMockData && !isInitializingKB;

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
              {shouldShowWarningBanner && !isInitializingKB && (
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
              
              {shouldShowSuccessBanner && (
                <div className="mb-6 p-4 border border-green-200 bg-green-50 rounded-lg text-left">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <h3 className="font-medium text-green-800">Connected to GitHub</h3>
                      <p className="text-sm text-green-700 mt-1">
                        You're using real data from the Ghost GitHub repository. 
                        {knowledgeStats && (
                          <span> The knowledge base has been populated with {knowledgeStats.totalEntries} insights from {knowledgeStats.processedFiles} files.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {isInitializingKB && (
                <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg text-left">
                  <div className="flex items-start">
                    <div className="animate-spin h-5 w-5 text-blue-500 mt-0.5 mr-2">⏳</div>
                    <div>
                      <h3 className="font-medium text-blue-800">Initializing Knowledge Base</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Please wait while we connect to the GitHub repository and build the knowledge base...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <QuestionInput onAskQuestion={handleAskQuestion} isProcessing={isProcessing || isInitializingKB} />
            
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
