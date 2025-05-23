
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slack } from "lucide-react";
import RepositoryStatus from "@/components/RepositoryStatus";
import QuestionHandler from "@/components/QuestionHandler";
import { useConnectionStatus, initializeConnection } from "@/components/ConnectionStatusManager";
import { shouldScanRepository } from "@/services/scanScheduler";
import { getActiveRepository } from "@/services/userRepositories";
import OnboardingPanel from "@/components/OnboardingPanel";

export default function Index() {
  const [connectionStatus, updateConnectionStatus] = useConnectionStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Initialize knowledge base on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize the connection to GitHub
        await initializeConnection(updateConnectionStatus);

        // Check if we need to scan the repository
        const activeRepo = getActiveRepository();
        
        // Determine if we should show onboarding
        setShowOnboarding(!activeRepo);
        
        if (activeRepo) {
          const needsScan = shouldScanRepository(activeRepo?.id);
          // Initialize the knowledge base (will use cache if available)
          await initializeKnowledgeBase(needsScan);
        }

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

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    updateConnectionStatus();
  };

  // Handle onboarding skip
  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
  };

  // Determine if we should show the banner - consider exploration status
  const shouldShowWarningBanner = (!connectionStatus.isConnected || connectionStatus.usingMockData) && 
    connectionStatus.explorationStatus !== "exploring" && !connectionStatus.showProgressIndicator && !showOnboarding;
  
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-1 container py-4 px-4 pb-20">
        {showOnboarding ? (
          <div className="py-10">
            <OnboardingPanel 
              onComplete={handleOnboardingComplete} 
              onSkip={handleOnboardingSkip} 
            />
          </div>
        ) : (
          <>
            {shouldShowWarningBanner && (
              <div className="mb-6">
                <RepositoryStatus 
                  bannerKey={connectionStatus.bannerKey} 
                  showProgressIndicator={connectionStatus.showProgressIndicator} 
                  shouldShowWarningBanner={shouldShowWarningBanner} 
                  isConnected={connectionStatus.isConnected} 
                  openConfigModal={openConfigModal} 
                />
              </div>
            )}
            
            <div className="max-w-3xl mx-auto">
              <QuestionHandler />
            </div>
          </>
        )}
      </main>
      
      <footer className="border-t py-4 text-sm text-muted-foreground mt-16">
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
