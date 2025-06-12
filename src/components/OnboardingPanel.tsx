import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ArrowRight, X, Check, ExternalLink, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { initGithubClient, validateGithubToken } from "@/services/githubClient";
import { saveRepositoryConfig } from "@/services/repositoryConfig";
import { setOpenAIApiKey, hasAICapabilities } from "@/services/aiAnalysis";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import { toast } from "sonner";

interface OnboardingPanelProps {
  onComplete: () => void;
  onSkip: () => void;
  className?: string;
}

export default function OnboardingPanel({ onComplete, onSkip, className = "" }: OnboardingPanelProps) {
  // GitHub repository settings
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  
  // OpenAI API key
  const [apiKey, setApiKey] = useState("");
  
  // Loading states
  const [isConnectingRepo, setIsConnectingRepo] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Collapsible states
  const [isTokenInfoOpen, setIsTokenInfoOpen] = useState(false);
  const [isRepoInfoOpen, setIsRepoInfoOpen] = useState(false);
  const [isApiKeyInfoOpen, setIsApiKeyInfoOpen] = useState(false);

  const totalSteps = 2;

  // Handle GitHub repository connection
  const handleConnectRepo = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      toast.error("Please fill in all repository fields");
      return;
    }

    setIsConnectingRepo(true);
    try {
      // Validate GitHub token
      const user = await validateGithubToken(token);
      if (!user) {
        toast.error("Invalid GitHub token");
        return;
      }

      // Save repository configuration
      saveRepositoryConfig({
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim()
      });
      
      // Initialize GitHub client
      initGithubClient(token.trim());
      
      // Initialize knowledge base
      toast.loading("Initializing repository...", { id: "init-repo", duration: 5000 });
      await initializeKnowledgeBase(true);
      toast.dismiss("init-repo");
      
      toast.success(`Repository ${owner}/${repo} connected successfully`);
      
      // Mark step as completed and move to next step
      setCompletedSteps([1]);
      setCurrentStep(2);
    } catch (error) {
      console.error("Error connecting repository:", error);
      toast.error("Failed to connect repository");
    } finally {
      setIsConnectingRepo(false);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your OpenAI API key");
      return;
    }

    setIsSavingApiKey(true);
    try {
      setOpenAIApiKey(apiKey.trim());
      toast.success("API key saved successfully");
      setCompletedSteps([1, 2]);
      onComplete();
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSkipStep = () => {
    if (currentStep === 1) {
      // Skip to API key step
      setCurrentStep(2);
    } else {
      // Skip everything and complete onboarding
      onSkip();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = completedSteps.includes(stepNumber);
        const isCurrent = currentStep === stepNumber;
        
        return (
          <React.Fragment key={stepNumber}>
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
              isCompleted 
                ? "bg-muted-foreground text-background" 
                : isCurrent 
                ? "bg-muted border border-muted-foreground text-muted-foreground" 
                : "bg-muted text-muted-foreground"
            }`}>
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{stepNumber}</span>
              )}
            </div>
            {index < totalSteps - 1 && (
              <div className={`w-8 h-px mx-2 ${
                isCompleted ? "bg-muted-foreground" : "bg-muted"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2">
              <GitHubLogoIcon className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Connect Your Repository</h3>
            <p className="text-sm text-muted-foreground">
              Connect to your GitHub repository to start exploring your codebase
            </p>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="owner">Repository Owner</Label>
            <Input
              id="owner"
              placeholder="e.g., TryGhost"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="repo">Repository Name</Label>
            <Input
              id="repo"
              placeholder="e.g., Ghost"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="token">GitHub Personal Access Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="github_pat_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            
            <Collapsible open={isTokenInfoOpen} onOpenChange={setIsTokenInfoOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between p-2 h-auto text-left mt-2"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Token Setup Instructions</span>
                  </div>
                  {isTokenInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm space-y-2 text-blue-800">
                    <p><strong>Recommended: Fine-Grained Personal Access Tokens</strong></p>
                    <p>1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens</p>
                    <p>2. Create a new token with <strong>read-only access</strong> to your repository</p>
                    <p>3. Grant these permissions: <strong>Contents (Read)</strong> and <strong>Metadata (Read)</strong></p>
                  </div>
                  <Button
                    variant="link" 
                    className="h-auto p-0 text-blue-600 text-sm mt-2"
                    onClick={() => window.open("https://github.com/settings/personal-access-tokens/new", "_blank")}
                  >
                    Create fine-grained token <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={isRepoInfoOpen} onOpenChange={setIsRepoInfoOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between p-2 h-auto text-left mt-1"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">Repository Requirements</span>
                  </div>
                  {isRepoInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">For best results, ensure your repository contains:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Source code files (.js, .ts, .jsx, .tsx, .py, etc.)</li>
                      <li>Documentation files (README.md, docs/, etc.)</li>
                      <li>Configuration files (package.json, requirements.txt, etc.)</li>
                      <li>API definitions or route files</li>
                      <li>Component and service files</li>
                    </ul>
                    <p className="mt-2 text-xs">The more comprehensive your codebase, the better our AI can understand and answer questions about it.</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <Button variant="outline" onClick={handleSkipStep}>
              Skip for now
            </Button>
            <Button 
              onClick={handleConnectRepo} 
              disabled={isConnectingRepo}
              className="flex items-center gap-2"
            >
              {isConnectingRepo ? "Connecting..." : "Connect Repository"}
              {!isConnectingRepo && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2">
              <KeyRound className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Add OpenAI API Key</h3>
            <p className="text-sm text-muted-foreground">
              Enable AI-powered code analysis and question answering
            </p>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="apikey">OpenAI API Key</Label>
            <Input
              id="apikey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            
            <Collapsible open={isApiKeyInfoOpen} onOpenChange={setIsApiKeyInfoOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between p-2 h-auto text-left mt-2"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Get your OpenAI API Key</span>
                  </div>
                  {isApiKeyInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm text-green-800 space-y-2">
                    <p>1. Sign in to your OpenAI account</p>
                    <p>2. Navigate to API keys section</p>
                    <p>3. Create a new API key with appropriate usage limits</p>
                  </div>
                  <Button
                    variant="link" 
                    className="h-auto p-0 text-green-600 text-sm mt-2"
                    onClick={() => window.open("https://platform.openai.com/settings/organization/api-keys", "_blank")}
                  >
                    Get your API key <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <p className="text-xs text-muted-foreground mt-2">
              Your API key stays in browser memory and is never stored permanently on our servers
            </p>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button variant="outline" onClick={onSkip}>
                Skip for now
              </Button>
            </div>
            <Button 
              onClick={handleSaveApiKey} 
              disabled={isSavingApiKey}
              className="flex items-center gap-2"
            >
              {isSavingApiKey ? "Saving..." : "Complete Setup"}
              {!isSavingApiKey && <Check className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className={`max-w-2xl mx-auto shadow-lg ${className}`}>
      <CardHeader className="relative">
        <Button 
          variant="ghost" 
          size="icon"
          className="absolute right-4 top-4" 
          onClick={onSkip}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {renderStepIndicator()}
        {renderStepContent()}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2 border-t pt-4">
        <div className="text-sm text-center text-muted-foreground">
          Step {currentStep} of {totalSteps} • You can always configure these settings later from the Settings page
        </div>
      </CardFooter>
    </Card>
  );
}
