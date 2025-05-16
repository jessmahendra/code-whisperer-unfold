
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { BookOpen, Code2, Info } from "lucide-react";
import { Link } from "react-router-dom";
import RepoConfigModal from "./RepoConfigModal";
import { getCurrentRepository } from "@/services/githubConnector";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isUsingMockData } from "@/services/knowledgeBase";
import { Button } from "./ui/button";
import { saveRepositoryConfig } from "@/services/repositoryConfig";
import { initGithubClient } from "@/services/githubClient";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import { toast } from "sonner";

export default function Header() {
  const [currentRepo, setCurrentRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [usingMockData, setUsingMockData] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const updateRepoInfo = () => {
    setCurrentRepo(getCurrentRepository());
    setUsingMockData(isUsingMockData());
  };

  useEffect(() => {
    updateRepoInfo();
  }, []);

  const connectToGhostRepo = async () => {
    setIsConnecting(true);
    
    // Prompt for GitHub token if not already set
    let token = prompt("Please enter your GitHub personal access token with 'repo' permissions:");
    
    if (!token) {
      setIsConnecting(false);
      toast.error("GitHub token required to connect to the repository");
      return;
    }
    
    try {
      // Initialize GitHub client
      const initialized = initGithubClient(token);
      
      if (!initialized) {
        toast.error("Failed to initialize GitHub client");
        setIsConnecting(false);
        return;
      }
      
      // Save Ghost repo configuration
      saveRepositoryConfig({ 
        owner: "TryGhost", 
        repo: "Ghost", 
        token 
      });
      
      // Initialize knowledge base
      await initializeKnowledgeBase(true);
      
      // Update UI
      updateRepoInfo();
      
      if (isUsingMockData()) {
        toast.warning("Still using mock data. Please check your token permissions.", {
          description: "Make sure your token has 'repo' scope access to public repositories."
        });
      } else {
        toast.success("Successfully connected to Ghost repository!", {
          description: "Knowledge base has been populated with real repository data."
        });
      }
    } catch (error) {
      console.error("Error connecting to Ghost repository:", error);
      toast.error("Failed to connect to Ghost repository", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-unfold-purple" />
            <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">Unfold</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-4">
            {currentRepo && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                usingMockData 
                  ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                  : 'bg-green-100 text-green-700 border border-green-200'
              }`}>
                {currentRepo.owner}/{currentRepo.repo}
                {usingMockData && (
                  <span className="ml-1 text-amber-600">(mock)</span>
                )}
              </span>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={connectToGhostRepo}
                    disabled={isConnecting}
                    className="flex items-center gap-1"
                  >
                    <GitHubLogoIcon className="h-4 w-4" />
                    {isConnecting ? "Connecting..." : "Connect to Ghost"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connect directly to the Ghost GitHub repository</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/TryGhost/Ghost"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-primary"
                  >
                    <GitHubLogoIcon className="h-5 w-5 mr-1" />
                    Ghost Repo
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View the Ghost GitHub repository</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/"
                    className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-primary"
                  >
                    <Code2 className="h-5 w-5 mr-1" />
                    API Docs
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View API documentation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <RepoConfigModal onConfigChange={updateRepoInfo} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configure GitHub repository connection</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </nav>
        </div>
      </div>
    </header>
  );
}
