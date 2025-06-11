import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { CodeIcon, CheckIcon, XIcon, InfoIcon, RefreshCwIcon, GithubIcon, AlertCircle } from "lucide-react";
import { getRepositoryConfig, saveRepositoryConfig, clearRepositoryConfig } from "@/services/repositoryConfig";
import { 
  initGithubClient, 
  validateGithubToken, 
  clearGithubClient 
} from "@/services/githubClient";
import { 
  clearKnowledgeBase, 
  initializeKnowledgeBase, 
  getKnowledgeBaseStats, 
  isUsingMockData,
  isInitializing,
  getInitializationState
} from "@/services/knowledgeBase";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import RepositoryProgressIndicator from "./RepositoryProgressIndicator";
import { getConnectionDiagnostics, getMostRelevantErrorMessage } from "@/services/githubConnector";
import { hasConfirmedSuccessfulFetch } from "@/services/githubConnector";

interface RepoConfigModalProps {
  onConfigChange: () => void;
}

export default function RepoConfigModal({ onConfigChange }: RepoConfigModalProps) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isInitializingRepo, setIsInitializingRepo] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [stats, setStats] = useState<ReturnType<typeof getKnowledgeBaseStats> | null>(null);
  const [isMockData, setIsMockData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionDiagnostics, setConnectionDiagnostics] = useState<ReturnType<typeof getConnectionDiagnostics> | null>(null);

  useEffect(() => {
    const config = getRepositoryConfig();
    if (config) {
      setOwner(config.owner);
      setRepo(config.repo);
      setToken(config.token);
      setIsConfigured(true);
      // Don't show the actual token, but indicate it's saved
      setValidationMessage("Token saved and validated");
      updateStats();
      updateDiagnostics();
    }
    
    // Check initialization status periodically
    const intervalId = setInterval(() => {
      // If we're initializing, check the status
      if (isInitializing()) {
        setIsInitializingRepo(true);
      } else if (isInitializingRepo) {
        // If we were initializing but now we're not, update stats
        setIsInitializingRepo(false);
        updateStats();
        updateDiagnostics();
        
        // Explicitly check if we've confirmed a successful fetch
        const hasRealData = hasConfirmedSuccessfulFetch() && !isUsingMockData();
        if (hasRealData) {
          toast.success("Successfully connected to repository with real data", { 
            id: "connection-success",
            duration: 3000 
          });
        }
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [isInitializingRepo]);

  const updateStats = () => {
    setStats(getKnowledgeBaseStats());
    setIsMockData(isUsingMockData());
  };
  
  const updateDiagnostics = () => {
    const diagnostics = getConnectionDiagnostics();
    setConnectionDiagnostics(diagnostics);
    
    // Get the most relevant error message
    const relevantError = getMostRelevantErrorMessage();
    setErrorMessage(relevantError);
  };

  const handleValidateToken = async () => {
    if (!token.trim()) {
      toast.error("Please enter a personal access token");
      return;
    }

    setIsValidating(true);
    try {
      const user = await validateGithubToken(token);
      if (user) {
        setValidationMessage(`✓ Token valid (authenticated as ${user.login})`);
        toast.success("GitHub token validated successfully");
      } else {
        setValidationMessage("✗ Invalid token");
        toast.error("Invalid GitHub token");
      }
    } catch (error) {
      console.error("Error validating token:", error);
      setValidationMessage("✗ Validation error");
      toast.error("Error validating GitHub token");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      // Clear any existing toasts to prevent confusion
      toast.dismiss();
      
      // Initialize GitHub client with the token
      const initialized = initGithubClient(token);
      if (!initialized) {
        toast.error("Failed to initialize GitHub client");
        return;
      }

      // Save the configuration
      saveRepositoryConfig({ owner, repo, token });
      setIsConfigured(true);
      toast.success("Repository configuration saved", { duration: 3000 });

      // Initialize knowledge base
      setIsInitializingRepo(true);
      toast.loading("Connecting to repository and building knowledge base...", { 
        id: "init-kb",
        duration: 10000  // 10 seconds timeout
      });
      
      await initializeKnowledgeBase(true);
      toast.dismiss("init-kb"); // Dismiss the loading toast
      
      updateStats();
      updateDiagnostics();
      
      // Check if we're still using mock data after initialization
      const usingMockData = isUsingMockData();
      setIsMockData(usingMockData);
      
      // Check if we've confirmed a successful fetch from GitHub
      const hasRealData = hasConfirmedSuccessfulFetch() && !usingMockData;
      
      if (hasRealData) {
        toast.success("Knowledge base initialized successfully with repository data", {
          id: "kb-success",
          duration: 3000
        });
      } else {
        const error = getMostRelevantErrorMessage() || "Unknown error";
        toast.warning(`Using mock data: ${error}`, {
          id: "mock-data-warning",
          description: "Please check your repository configuration and token permissions."
        });
      }

      // Notify parent component
      onConfigChange();
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Failed to save configuration");
      updateDiagnostics();
    } finally {
      setIsInitializingRepo(false);
    }
  };

  const handleClearConfig = () => {
    clearRepositoryConfig();
    clearGithubClient();
    clearKnowledgeBase();
    setOwner("");
    setRepo("");
    setToken("");
    setIsConfigured(false);
    setValidationMessage("");
    setStats(null);
    setIsMockData(true);
    setErrorMessage(null);
    setConnectionDiagnostics(null);
    toast.success("Repository configuration cleared");
    onConfigChange();
  };

  const handleRefreshKnowledgeBase = async () => {
    if (!isConfigured) return;
    
    // Clear any existing toasts
    toast.dismiss();
    
    setIsInitializingRepo(true);
    try {
      toast.loading("Refreshing knowledge base...", { 
        id: "refresh-kb",
        duration: 8000 
      });
      
      await initializeKnowledgeBase(true); // Force refresh
      toast.dismiss("refresh-kb");
      
      updateStats();
      updateDiagnostics();
      
      // Check if we're using real data after refresh
      const hasRealData = hasConfirmedSuccessfulFetch() && !isUsingMockData();
      
      if (hasRealData) {
        toast.success("Knowledge base refreshed with actual repository data", {
          id: "refresh-success",
          duration: 3000
        });
      } else {
        const error = getMostRelevantErrorMessage() || "Unknown error";
        toast.warning(`Still using mock data after refresh: ${error}`, {
          id: "refresh-warning",
          duration: 5000
        });
      }
    } catch (error) {
      console.error("Error refreshing knowledge base:", error);
      toast.error("Failed to refresh knowledge base");
      updateDiagnostics();
    } finally {
      setIsInitializingRepo(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <CodeIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Repository Configuration</SheetTitle>
          <SheetDescription>
            Connect to a GitHub repository to enable knowledge extraction
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {isInitializingRepo && (
            <RepositoryProgressIndicator />
          )}
        
          {isConfigured && isMockData && (
            <Alert variant="warning" className="mb-4">
              <AlertTitle className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                Using Mock Data
              </AlertTitle>
              <AlertDescription>
                {errorMessage ? (
                  <span>
                    Unable to access repository data: <strong>{errorMessage}</strong>. 
                    You're currently using mock Ghost data.
                  </span>
                ) : (
                  <span>
                    Unable to access repository data. Please check your token permissions 
                    and repository details.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="owner">Repository Owner</Label>
            <div className="flex space-x-2">
              <Input
                id="owner"
                placeholder="e.g., TryGhost"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
              {owner === "TryGhost" && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => window.open("https://github.com/TryGhost", "_blank")}
                >
                  <GithubIcon className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo">Repository Name</Label>
            <div className="flex space-x-2">
              <Input
                id="repo"
                placeholder="e.g., Ghost"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
              {repo === "Ghost" && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => window.open("https://github.com/TryGhost/Ghost", "_blank")}
                >
                  <GithubIcon className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">
              GitHub Personal Access Token 
              <span className="text-xs text-muted-foreground ml-1">
                (classic or fine-grained)
              </span>
            </Label>
            <div className="flex space-x-2">
              <Input
                id="token"
                type="password"
                placeholder="ghp_... or github_pat_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button 
                variant="outline" 
                onClick={handleValidateToken}
                disabled={isValidating || !token.trim()}
              >
                {isValidating ? "Validating..." : "Validate"}
              </Button>
            </div>
            {validationMessage && (
              <p className={`text-sm ${validationMessage.includes("✓") ? "text-green-500" : "text-red-500"}`}>
                {validationMessage}
              </p>
            )}
            
            {connectionDiagnostics && connectionDiagnostics.errors.auth && (
              <Alert variant="destructive" className="mt-2">
                <AlertTitle className="text-sm">Authentication Error</AlertTitle>
                <AlertDescription className="text-xs">
                  {connectionDiagnostics.errors.auth.message}
                </AlertDescription>
              </Alert>
            )}
            
            {connectionDiagnostics && connectionDiagnostics.errors.rateLimit && (
              <Alert variant="warning" className="mt-2">
                <AlertTitle className="text-sm">Rate Limit Reached</AlertTitle>
                <AlertDescription className="text-xs">
                  {connectionDiagnostics.errors.rateLimit.message}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="mt-2 text-sm text-muted-foreground border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded">
              <p className="flex items-center mb-1">
                <InfoIcon className="h-4 w-4 mr-1 inline" />
                <strong>Token Requirements:</strong>
              </p>
              <div className="space-y-2">
                <div>
                  <p className="font-medium text-blue-700">Fine-grained tokens (recommended):</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>Repository permissions: Contents (Read), Metadata (Read)</li>
                    <li>More secure with specific repository access</li>
                    <li>Better rate limits and permissions control</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-blue-700">Classic tokens:</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>Scope: 'repo' (full repository access)</li>
                    <li>Works with all repositories you have access to</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-2 text-sm text-muted-foreground border-l-4 border-amber-500 pl-4 py-2 bg-amber-50 rounded">
              <p className="flex items-center mb-1">
                <InfoIcon className="h-4 w-4 mr-1 inline" />
                <strong>Troubleshooting tips:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>For fine-grained tokens: Ensure Contents + Metadata permissions</li>
                <li>For classic tokens: Make sure 'repo' scope is selected</li>
                <li>For the Ghost repo, use owner "TryGhost" and repo "Ghost"</li>
                <li>Check if the repository exists and is accessible</li>
                <li>Try refreshing if data doesn't appear immediately</li>
                <li>If you hit rate limits, wait a few minutes and try again</li>
              </ul>
            </div>
          </div>

          {stats && (
            <div className="mt-4 p-3 bg-slate-100 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Knowledge Base Stats</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRefreshKnowledgeBase}
                  disabled={isInitializingRepo}
                  className="h-8 px-2"
                >
                  <RefreshCwIcon className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Total entries: {stats.totalEntries}</p>
                <p>Comments: {stats.byType.comment}</p>
                <p>Functions: {stats.byType.function}</p>
                <p>Exports: {stats.byType.export}</p>
                <p>Processed files: {stats.processedFiles}</p>
                <p className={`font-medium ${isMockData ? 'text-amber-500' : 'text-green-600'}`}>
                  {isMockData ? '⚠️ Using mock data' : '✓ Using repository data'}
                </p>
              </div>
            </div>
          )}

          <SheetFooter className="flex justify-between gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClearConfig}
              disabled={!isConfigured || isInitializingRepo}
            >
              <XIcon className="h-4 w-4 mr-1" />
              Clear Configuration
            </Button>
            
            <Button
              onClick={handleSaveConfig}
              disabled={isInitializingRepo || !owner.trim() || !repo.trim() || !token.trim()}
            >
              {isInitializingRepo ? (
                "Initializing..."
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 mr-1" />
                  {isConfigured ? "Update & Reload" : "Save Configuration"}
                </>
              )}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
