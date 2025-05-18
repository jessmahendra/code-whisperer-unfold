
import { useEffect } from "react";
import Header from "@/components/Header";
import GradientBackground from "@/components/GradientBackground";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slack } from "lucide-react";
import RepositoryStatus from "@/components/RepositoryStatus";
import QuestionHandler from "@/components/QuestionHandler";
import { useConnectionStatus, initializeConnection } from "@/components/ConnectionStatusManager";

export default function Index() {
  const [connectionStatus, updateConnectionStatus] = useConnectionStatus();
  
  // Initialize knowledge base on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize the connection to GitHub
        await initializeConnection(updateConnectionStatus);
        
        // Initialize the knowledge base
        await initializeKnowledgeBase();
        
        // Update connection status
        updateConnectionStatus();
      } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
      } finally {
        updateConnectionStatus();
      }
    };
    initialize();

    // Poll for updates
    const intervalId = setInterval(() => {
      updateConnectionStatus();
    }, 300);
    return () => clearInterval(intervalId);
  }, [updateConnectionStatus]);

  const openConfigModal = () => {
    // Find and click the config button in the header
    const configButton = document.querySelector('header button') as HTMLButtonElement;
    if (configButton) {
      configButton.click();
    }
  };

  // Determine if we should show the banner - consider exploration status
  const shouldShowWarningBanner = (
    !connectionStatus.isConnected || 
    connectionStatus.usingMockData
  ) && 
  connectionStatus.explorationStatus !== "exploring" && 
  !connectionStatus.showProgressIndicator;

  return (
    <GradientBackground>
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container py-8">
          <section className="max-w-3xl mx-auto mb-12">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
                Unfold
              </h1>
              <p className="text-xl">
                Instant answers to your Ghost product questions, extracted directly from code.
              </p>
            </div>
            
            <RepositoryStatus
              bannerKey={connectionStatus.bannerKey}
              showProgressIndicator={connectionStatus.showProgressIndicator}
              shouldShowWarningBanner={shouldShowWarningBanner}
              isConnected={connectionStatus.isConnected}
              openConfigModal={openConfigModal}
            />
            
            <QuestionHandler
              isProcessing={connectionStatus.isInitializingKB}
              isInitializingKB={connectionStatus.isInitializingKB}
              isAIEnabled={connectionStatus.isAIEnabled}
            />
          </section>
        </main>
        
        <footer className="border-t py-6 text-sm text-muted-foreground">
          <div className="container relative">
            <div className="text-center">
              <p>Currently using {connectionStatus.usingMockData ? 'mock' : 'repository'} data for knowledge base</p>
              {connectionStatus.isAIEnabled && <p className="text-green-600 text-xs mt-1">AI-powered answers enabled</p>}
            </div>
            <Button variant="ghost" size="icon" asChild className="absolute bottom-0 right-0 hover:bg-slate-100">
              <Link to="/slack-demo">
                <Slack className="h-5 w-5 text-slate-600" />
              </Link>
            </Button>
          </div>
        </footer>
      </div>
    </GradientBackground>
  );
}
