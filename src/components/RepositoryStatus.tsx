
import React from "react";
import { AlertTriangle, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import RepositoryProgressIndicator from "@/components/RepositoryProgressIndicator";
import { toast } from "sonner";
import { hasConfirmedSuccessfulFetch } from "@/services/githubConnector";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";

interface RepositoryStatusProps {
  bannerKey: number;
  showProgressIndicator: boolean;
  shouldShowWarningBanner: boolean;
  isConnected: boolean;
  openConfigModal: () => void;
}

export default function RepositoryStatus({
  bannerKey,
  showProgressIndicator,
  shouldShowWarningBanner,
  isConnected,
  openConfigModal
}: RepositoryStatusProps) {
  const handleRefresh = async () => {
    toast.dismiss(); // Clear any existing toasts
    
    // Show loading toast with reasonable timeout
    toast.loading("Refreshing repository connection...", { 
      id: "refresh-repo",
      duration: 5000
    });
    
    try {
      await initializeKnowledgeBase(true);
      toast.dismiss("refresh-repo");
      
      const hasRealData = hasConfirmedSuccessfulFetch();
      if (hasRealData) {
        toast.success("Successfully refreshed with real repository data", { duration: 3000 });
      } else {
        toast.warning("Still using mock data after refresh", { duration: 4000 });
      }
    } catch (error) {
      console.error("Error refreshing repository:", error);
      toast.error("Failed to refresh repository connection");
    }
  };
  
  return (
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
                {!isConnected
                  ? "You're currently using mock data. To connect to the Ghost GitHub repository, click the button below."
                  : "You've connected to GitHub but we're still using mock data. This might happen if the repository structure doesn't match our expectations or if your token lacks permissions."}
              </p>
              <div className="mt-2 flex space-x-2">
                <Button size="sm" variant="outline" className="bg-white" onClick={openConfigModal}>
                  <Github className="h-4 w-4 mr-1" />
                  {!isConnected ? "Configure GitHub Connection" : "Check GitHub Connection"}
                </Button>
                
                {isConnected && (
                  <Button size="sm" variant="outline" className="bg-white" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry Connection
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { CodeIcon } from "lucide-react";
