
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { BookOpen, Code2, Info, KeyRound } from "lucide-react";
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
import { hasAICapabilities, setOpenAIApiKey } from "@/services/aiAnalysis";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function Header() {
  const [currentRepo, setCurrentRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [usingMockData, setUsingMockData] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [openaiDialogOpen, setOpenaiDialogOpen] = useState(false);

  const updateRepoInfo = () => {
    setCurrentRepo(getCurrentRepository());
    setUsingMockData(isUsingMockData());
    setIsAIEnabled(hasAICapabilities());
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
      console.log("Starting Ghost repo connection process...");
      
      // Initialize GitHub client
      const initialized = initGithubClient(token);
      
      if (!initialized) {
        toast.error("Failed to initialize GitHub client");
        setIsConnecting(false);
        return;
      }
      
      console.log("GitHub client initialized successfully, saving configuration...");
      
      // Save Ghost repo configuration
      saveRepositoryConfig({ 
        owner: "TryGhost", 
        repo: "Ghost", 
        token 
      });
      
      console.log("Configuration saved, initializing knowledge base...");
      
      // Initialize knowledge base with force refresh
      await initializeKnowledgeBase(true);
      
      // Update UI
      updateRepoInfo();
      
      console.log("Knowledge base initialized, checking data source...");
      
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

  const handleOpenAIKeySave = () => {
    if (openaiKey.trim()) {
      setOpenAIApiKey(openaiKey.trim());
      setOpenaiDialogOpen(false);
      setIsAIEnabled(true);
    } else {
      toast.error("Please enter a valid OpenAI API key");
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
            
            {/* OpenAI API Key Dialog */}
            <Dialog open={openaiDialogOpen} onOpenChange={setOpenaiDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant={isAIEnabled ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <KeyRound className="h-4 w-4" />
                  {isAIEnabled ? "AI Enabled" : "Set OpenAI Key"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>OpenAI API Configuration</DialogTitle>
                  <DialogDescription>
                    Add your OpenAI API key to enable AI-powered code analysis and answers.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="openai-key" className="col-span-4">
                      API Key
                    </Label>
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="sk-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="col-span-4"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Your API key is not stored permanently and will be lost when you refresh the page.
                    For real applications, use a secure backend to handle API keys.
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleOpenAIKeySave}>Save API Key</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
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
