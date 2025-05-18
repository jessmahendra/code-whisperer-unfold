
import { useEffect, useCallback, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { hasRepositoryConfig, getRepositoryConfig } from "@/services/repositoryConfig";
import { isGithubClientInitialized, initGithubClient } from "@/services/githubClient";
import { getConnectionDiagnostics } from "@/services/githubConnector";
import { getExplorationProgress } from "@/services/knowledgeBase/pathExplorer";
import { isUsingMockData, getKnowledgeBaseStats, isInitializing } from "@/services/knowledgeBase";
import { hasAICapabilities, wasAPIKeyPreviouslySet } from "@/services/aiAnalysis";

interface ConnectionStatus {
  isInitializingKB: boolean;
  hasRepo: boolean;
  isConnected: boolean;
  usingMockData: boolean;
  knowledgeStats: ReturnType<typeof getKnowledgeBaseStats> | null;
  bannerKey: number;
  explorationStatus: "idle" | "exploring" | "complete" | "error";
  showProgressIndicator: boolean;
  isAIEnabled: boolean;
}

export function useConnectionStatus(): [ConnectionStatus, () => void] {
  const [isInitializingKB, setIsInitializingKB] = useState(true);
  const [hasRepo, setHasRepo] = useState(hasRepositoryConfig());
  const [isConnected, setIsConnected] = useState(false);
  const [usingMockData, setUsingMockData] = useState(true);
  const [knowledgeStats, setKnowledgeStats] = useState<ReturnType<typeof getKnowledgeBaseStats> | null>(null);
  const [bannerKey, setBannerKey] = useState(0);
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

  // Return everything needed by the components
  return [
    {
      isInitializingKB,
      hasRepo,
      isConnected,
      usingMockData,
      knowledgeStats,
      bannerKey,
      explorationStatus,
      showProgressIndicator,
      isAIEnabled
    },
    updateConnectionStatus
  ];
}

export async function initializeConnection(updateConnectionStatus: () => void) {
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

    // Check if API key was previously set and notify the user
    if (wasAPIKeyPreviouslySet() && !hasAICapabilities()) {
      toast.info("OpenAI API key needed", {
        description: "You previously used AI features. Please re-enter your OpenAI API key.",
        duration: 5000
      });
    }
  } catch (error) {
    console.error("Failed to initialize connection:", error);
    toast.error("Failed to initialize connection");
  } finally {
    // Final status update
    updateConnectionStatus();
  }
}
