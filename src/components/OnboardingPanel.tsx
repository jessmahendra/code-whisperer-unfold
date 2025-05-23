
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ArrowRight, X } from "lucide-react";
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
  
  // Tab state
  const [activeTab, setActiveTab] = useState("github");

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
      
      // Move to the API key tab if not already set up
      if (!hasAICapabilities()) {
        setActiveTab("openai");
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Error connecting repository:", error);
      toast.error("Failed to connect repository");
    } finally {
      setIsConnectingRepo(false);
    }
  };

  // Handle API key setup
  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your OpenAI API key");
      return;
    }

    setIsSavingApiKey(true);
    try {
      setOpenAIApiKey(apiKey.trim());
      toast.success("API key saved successfully");
      onComplete();
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setIsSavingApiKey(false);
    }
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
        <CardTitle className="text-2xl">Welcome to Unfold</CardTitle>
        <CardDescription>
          Let's get you set up to explore code repositories with AI assistance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="github" className="flex items-center gap-2">
              <GitHubLogoIcon className="h-4 w-4" />
              GitHub Repository
            </TabsTrigger>
            <TabsTrigger value="openai" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              OpenAI API Key
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="github" className="pt-4">
            <div className="space-y-4">
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
                  placeholder="ghp_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your token needs 'repo' scope permissions to access the repository
                </p>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={onSkip}>
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
          </TabsContent>
          
          <TabsContent value="openai" className="pt-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="apikey">OpenAI API Key</Label>
                <Input
                  id="apikey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your API key stays in browser memory and is never stored permanently
                </p>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={onSkip}>
                  Skip for now
                </Button>
                <Button 
                  onClick={handleSaveApiKey} 
                  disabled={isSavingApiKey}
                  className="flex items-center gap-2"
                >
                  {isSavingApiKey ? "Saving..." : "Save API Key"}
                  {!isSavingApiKey && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2 border-t pt-4">
        <div className="text-sm text-center text-muted-foreground">
          You can always configure these settings later from the Settings page
        </div>
      </CardFooter>
    </Card>
  );
}
