import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { BookOpen, Code2, Info, KeyRound, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import RepoConfigModal from "./RepoConfigModal";
import { getCurrentRepository, getConnectionDiagnostics, getMostRelevantErrorMessage } from "@/services/githubConnector";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isUsingMockData, isInitializing, initializeKnowledgeBase } from "@/services/knowledgeBase";
import { Button } from "./ui/button";
import { saveRepositoryConfig, getRepositoryConfig } from "@/services/repositoryConfig";
import { initGithubClient, validateGithubToken, isGithubClientInitialized } from "@/services/githubClient";
import { toast, dismissToast } from "@/components/ui/sonner";
import { hasAICapabilities, setOpenAIApiKey, wasAPIKeyPreviouslySet, getAPIKeyState } from "@/services/aiAnalysis";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import RepositoryProgressIndicator from "./RepositoryProgressIndicator";
export default function Header() {
  const [currentRepo, setCurrentRepo] = useState<{
    owner: string;
    repo: string;
  } | null>(null);
  const [usingMockData, setUsingMockData] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [openaiDialogOpen, setOpenaiDialogOpen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'partial' | 'connected'>('disconnected');
  const [showProgressIndicator, setShowProgressIndicator] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ReturnType<typeof getAPIKeyState> | null>(null);
  const updateRepoInfo = () => {
    setCurrentRepo(getCurrentRepository());
    setUsingMockData(isUsingMockData());
    setIsAIEnabled(hasAICapabilities());
    setApiKeyStatus(getAPIKeyState());

    // Get connection diagnostics to set accurate status
    const diagnostics = getConnectionDiagnostics();
    if (!diagnostics.initialized || !diagnostics.configured) {
      setConnectionStatus('disconnected');
    } else if (isUsingMockData()) {
      setConnectionStatus('partial');
      setConnectionError(getMostRelevantErrorMessage());
    } else {
      setConnectionStatus('connected');
      setConnectionError(null);
    }

    // Check if we're initializing
    if (isInitializing()) {
      setConnectionStatus('connecting');
      setShowProgressIndicator(true);
    } else {
      setShowProgressIndicator(false);
    }
  };
  useEffect(() => {
    updateRepoInfo();

    // Try to automatically reconnect if we have a stored token
    const autoReconnect = async () => {
      const config = getRepositoryConfig();
      if (config && !isGithubClientInitialized()) {
        console.log("Found existing repository configuration in Header, reconnecting...");
        initGithubClient(config.token);
        updateRepoInfo();
      }
    };
    autoReconnect();

    // Check if API key was previously set and prompt user
    if (wasAPIKeyPreviouslySet() && !hasAICapabilities()) {
      setIsAIEnabled(false); // Make sure we don't falsely report AI as enabled

      // Show a quieter notification in the header - we'll use the badge state
      // instead of a toast to avoid notification overload
    }

    // Poll for changes to connection status
    const intervalId = setInterval(() => {
      updateRepoInfo();
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);
  const connectToGhostRepo = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    setConnectionStatus('connecting');
    setShowProgressIndicator(true);

    // Dismiss any existing toasts first
    toast.dismiss();

    // Prompt for GitHub token if not already set
    let token = prompt("Please enter your GitHub personal access token with 'repo' permissions:");
    if (!token) {
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      setShowProgressIndicator(false);
      toast.error("GitHub token required to connect to the repository");
      return;
    }
    try {
      console.log("Starting Ghost repo connection process...");

      // Validate token first
      const user = await validateGithubToken(token);
      if (!user) {
        setIsConnecting(false);
        setConnectionError("Invalid GitHub token. Please check your token and try again.");
        setConnectionStatus('disconnected');
        setShowProgressIndicator(false);
        return;
      }

      // Initialize GitHub client
      const initialized = initGithubClient(token);
      if (!initialized) {
        toast.error("Failed to initialize GitHub client");
        setConnectionError("Failed to initialize GitHub client");
        setIsConnecting(false);
        setConnectionStatus('disconnected');
        setShowProgressIndicator(false);
        return;
      }
      console.log("GitHub client initialized successfully, saving configuration...");
      toast.success(`Authenticated as ${user.login}`, { duration: 3000 });

      // Save Ghost repo configuration
      saveRepositoryConfig({
        owner: "TryGhost",
        repo: "Ghost",
        token
      });
      console.log("Configuration saved, initializing knowledge base...");
      
      // Use shorter duration for the loading toast
      const loadingToastId = toast.loading("Connecting to Ghost repository...", {
        duration: 5000 // 5 seconds max
      });

      // Initialize knowledge base with force refresh
      await initializeKnowledgeBase(true);
      
      // Dismiss the loading toast
      toast.dismiss(loadingToastId);

      // Update UI
      updateRepoInfo();
      console.log("Knowledge base initialized, checking data source...");
      if (isUsingMockData()) {
        const errorMsg = getMostRelevantErrorMessage() || "Could not access repository data";
        setConnectionError(errorMsg);
        setConnectionStatus('partial');
        toast.warning(`Connected to GitHub, but ${errorMsg}`, {
          description: "Using mock data instead. Check console for details.",
          duration: 4000
        });
      } else {
        toast.success("Successfully connected to Ghost repository!", {
          description: "Knowledge base has been populated with real repository data.",
          duration: 3000
        });
        setConnectionError(null);
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error("Error connecting to Ghost repository:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setConnectionError(`Error: ${errorMessage}`);
      setConnectionStatus('disconnected');
      toast.error("Failed to connect to Ghost repository", {
        description: errorMessage,
        duration: 4000
      });
    } finally {
      setIsConnecting(false);
      setShowProgressIndicator(false);
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
  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case 'disconnected':
        return {
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
          text: 'Not connected',
          color: 'text-red-500'
        };
      case 'connecting':
        return {
          icon: <AlertCircle className="h-4 w-4 text-amber-500 animate-pulse" />,
          text: 'Connecting...',
          color: 'text-amber-500'
        };
      case 'partial':
        return {
          icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
          text: 'Partial connection',
          color: 'text-amber-500'
        };
      case 'connected':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          text: 'Connected',
          color: 'text-green-500'
        };
    }
  };
  const statusInfo = getConnectionStatusInfo();
  return <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-unfold-purple" />
            <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">Unfold</span>
          </Link>
        </div>
        
        {showProgressIndicator && <div className="flex-1 max-w-md px-2">
            <RepositoryProgressIndicator />
          </div>}
        
        <div className={`flex ${showProgressIndicator ? '' : 'flex-1'} items-center justify-between space-x-2 md:justify-end`}>
          <nav className="flex items-center space-x-4">
            {currentRepo && <div className="flex items-center">
                
                
                {connectionError && <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertCircle className="ml-2 h-4 w-4 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">{connectionError}</p>
                        <p className="text-xs mt-1 text-muted-foreground">
                          Try reconnecting or check your token permissions
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>}
              </div>}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={connectToGhostRepo} disabled={isConnecting} className={`flex items-center gap-1 ${connectionStatus === 'connected' ? 'bg-green-50 border-green-200' : ''}`}>
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
                <Button variant={isAIEnabled ? "default" : wasAPIKeyPreviouslySet() ? "outline" : "outline"} size="sm" className={`flex items-center gap-1 ${apiKeyStatus?.lastError ? 'bg-red-50 hover:bg-red-100 border-red-200' : wasAPIKeyPreviouslySet() && !isAIEnabled ? 'bg-amber-50 hover:bg-amber-100 border-amber-200' : ''}`}>
                  <KeyRound className="h-4 w-4" />
                  {isAIEnabled ? apiKeyStatus?.lastError ? "AI Error" : "AI Enabled" : wasAPIKeyPreviouslySet() ? "Re-enter API Key" : "Set OpenAI Key"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>OpenAI API Configuration</DialogTitle>
                  <DialogDescription>
                    {wasAPIKeyPreviouslySet() && !isAIEnabled ? "Please re-enter your OpenAI API key to enable AI-powered analysis." : "Add your OpenAI API key to enable AI-powered code analysis and answers."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {apiKeyStatus?.lastError && <Alert variant="destructive" className="mb-2">
                      <AlertTitle className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        API Key Error
                      </AlertTitle>
                      <AlertDescription>
                        {apiKeyStatus.lastError}
                      </AlertDescription>
                    </Alert>}
                  
                  {wasAPIKeyPreviouslySet() && !isAIEnabled && !apiKeyStatus?.lastError && <Alert variant="warning" className="mb-2">
                      <AlertTitle className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        API Key Required
                      </AlertTitle>
                      <AlertDescription>
                        You previously set an API key, but it needs to be re-entered after page refresh.
                      </AlertDescription>
                    </Alert>}
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="openai-key" className="col-span-4">
                      API Key
                    </Label>
                    <Input id="openai-key" type="password" placeholder="sk-..." value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} className="col-span-4" />
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
            
            {/* Connection troubleshooting alert */}
            {connectionError && !showProgressIndicator && <Alert variant="warning" className="hidden lg:flex max-w-xs items-center py-1 h-9">
                <AlertDescription className="text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {connectionError.length > 60 ? `${connectionError.substring(0, 60)}...` : connectionError}
                </AlertDescription>
              </Alert>}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  
                </TooltipTrigger>
                <TooltipContent>
                  <p>View the Ghost GitHub repository</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  
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
    </header>;
}
