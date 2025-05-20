
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

        // Initialize the knowledge base with force refresh to ensure we get fresh data
        await initializeKnowledgeBase(true);

        // Update connection status
        updateConnectionStatus();
      } catch (error) {
        console.error("Failed to initialize knowledge base:", error);
      } finally {
        updateConnectionStatus();
      }
    };
    initialize();

    // Poll for updates more frequently to reflect changes in connection status
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
  const shouldShowWarningBanner = (!connectionStatus.isConnected || connectionStatus.usingMockData) && 
    connectionStatus.explorationStatus !== "exploring" && !connectionStatus.showProgressIndicator;
  
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-1 container py-8 px-4">
        <section className="max-w-3xl mx-auto">
          {shouldShowWarningBanner && (
            <RepositoryStatus 
              bannerKey={connectionStatus.bannerKey} 
              showProgressIndicator={connectionStatus.showProgressIndicator} 
              shouldShowWarningBanner={shouldShowWarningBanner} 
              isConnected={connectionStatus.isConnected} 
              openConfigModal={openConfigModal} 
            />
          )}
          
          <QuestionHandler 
            isProcessing={connectionStatus.isInitializingKB} 
            isInitializingKB={connectionStatus.isInitializingKB} 
            isAIEnabled={connectionStatus.isAIEnabled} 
            usingMockData={connectionStatus.usingMockData} 
          />
        </section>
      </main>
      
      <footer className="border-t py-4 text-sm text-muted-foreground">
        <div className="container relative">
          <div className="text-center">
            <p>Currently using {connectionStatus.usingMockData ? 'mock' : 'repository'} data for knowledge base</p>
          </div>
          <Button variant="ghost" size="icon" asChild className="absolute bottom-0 right-0 hover:bg-slate-100">
            <Link to="/slack-demo">
              <Slack className="h-5 w-5 text-slate-600" />
            </Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
