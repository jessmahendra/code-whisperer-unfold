
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
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { CodeIcon, CheckIcon, XIcon, InfoIcon, RefreshCwIcon } from "lucide-react";
import { getRepositoryConfig, saveRepositoryConfig, clearRepositoryConfig } from "@/services/repositoryConfig";
import { initGithubClient, validateGithubToken, clearGithubClient } from "@/services/githubClient";
import { clearKnowledgeBase, initializeKnowledgeBase, getKnowledgeBaseStats } from "@/services/knowledgeBase";

interface RepoConfigModalProps {
  onConfigChange: () => void;
}

export default function RepoConfigModal({ onConfigChange }: RepoConfigModalProps) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [stats, setStats] = useState<ReturnType<typeof getKnowledgeBaseStats> | null>(null);

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
    }
  }, []);

  const updateStats = () => {
    setStats(getKnowledgeBaseStats());
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
      // Initialize GitHub client with the token
      const initialized = initGithubClient(token);
      if (!initialized) {
        toast.error("Failed to initialize GitHub client");
        return;
      }

      // Save the configuration
      saveRepositoryConfig({ owner, repo, token });
      setIsConfigured(true);
      toast.success("Repository configuration saved");

      // Initialize knowledge base
      setIsInitializing(true);
      await initializeKnowledgeBase(true);
      updateStats();
      
      if (getKnowledgeBaseStats().totalEntries > 0) {
        toast.success("Knowledge base initialized successfully");
      } else {
        toast.warning("Knowledge base initialized with 0 entries. Check if the repository exists and your token has access permissions.");
      }

      // Notify parent component
      onConfigChange();
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsInitializing(false);
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
    toast.success("Repository configuration cleared");
    onConfigChange();
  };

  const handleRefreshKnowledgeBase = async () => {
    if (!isConfigured) return;
    
    setIsInitializing(true);
    try {
      await initializeKnowledgeBase(true); // Force refresh
      updateStats();
      toast.success("Knowledge base refreshed");
    } catch (error) {
      console.error("Error refreshing knowledge base:", error);
      toast.error("Failed to refresh knowledge base");
    } finally {
      setIsInitializing(false);
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
          <div className="space-y-2">
            <Label htmlFor="owner">Repository Owner</Label>
            <Input
              id="owner"
              placeholder="e.g., TryGhost"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo">Repository Name</Label>
            <Input
              id="repo"
              placeholder="e.g., Ghost"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">
              GitHub Personal Access Token 
              <span className="text-xs text-muted-foreground ml-1">
                (needs repo scope)
              </span>
            </Label>
            <div className="flex space-x-2">
              <Input
                id="token"
                type="password"
                placeholder="ghp_..."
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
            
            <div className="mt-2 text-sm text-muted-foreground border-l-4 border-amber-500 pl-4 py-2 bg-amber-50 rounded">
              <p className="flex items-center mb-1">
                <InfoIcon className="h-4 w-4 mr-1 inline" />
                <strong>Troubleshooting tips:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Make sure the token has 'repo' scope permissions</li>
                <li>Verify that the repository owner and name are correct</li>
                <li>Check that your token has access to the repository</li>
                <li>For private repos, ensure your account has access</li>
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
                  disabled={isInitializing}
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
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleClearConfig}
              disabled={!isConfigured || isInitializing}
            >
              <XIcon className="h-4 w-4 mr-1" />
              Clear Configuration
            </Button>
            
            <Button
              onClick={handleSaveConfig}
              disabled={isInitializing || !owner.trim() || !repo.trim() || !token.trim()}
            >
              {isInitializing ? (
                "Initializing..."
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 mr-1" />
                  {isConfigured ? "Update" : "Save Configuration"}
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
