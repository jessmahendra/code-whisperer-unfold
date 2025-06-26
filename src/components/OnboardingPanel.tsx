import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  KeyRound,
  ArrowRight,
  X,
  Check,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
  Lock,
  Globe,
  GitBranch,
  Calendar,
  Search,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { initGithubClient, validateGithubToken } from "@/services/githubClient";
import { saveRepositoryConfig } from "@/services/repositoryConfig";
import { setOpenAIApiKey, hasAICapabilities } from "@/services/aiAnalysis";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import { toast } from "sonner";
import RepositoryBrowser from "./RepositoryBrowser";
import EnhancedRepositoryBrowser from "./EnhancedRepositoryBrowser";
import {
  initiateGitHubOAuth,
  handleOAuthCallback,
  getGitHubAuthState,
  fetchGitHubUser,
  fetchUserRepositories,
  logoutGitHub,
  isOAuthCallback,
  GitHubRepository,
  GitHubUser,
  getStoredToken,
  getStoredRepos,
} from "@/services/githubOAuth";

interface OnboardingPanelProps {
  onComplete: () => void;
  onSkip: () => void;
  className?: string;
}

export default function OnboardingPanel({
  onComplete,
  onSkip,
  className = "",
}: OnboardingPanelProps) {
  // GitHub OAuth state
  const [githubAuth, setGithubAuth] = useState(getGitHubAuthState());
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepository[]>([]);

  // Manual repository settings (fallback)
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");

  // OpenAI API key
  const [apiKey, setApiKey] = useState("");

  // Loading states
  const [isConnectingRepo, setIsConnectingRepo] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Collapsible states
  const [isTokenInfoOpen, setIsTokenInfoOpen] = useState(false);
  const [isRepoInfoOpen, setIsRepoInfoOpen] = useState(false);
  const [isApiKeyInfoOpen, setIsApiKeyInfoOpen] = useState(false);
  const [isPrivacyInfoOpen, setIsPrivacyInfoOpen] = useState(false);

  const totalSteps = 5;

  // Handle OAuth callback on component mount
  useEffect(() => {
    if (isOAuthCallback()) {
      handleOAuthCallback().then((success) => {
        if (success) {
          setGithubAuth(getGitHubAuthState());
          setCurrentStep(3); // Move to repository selection
          setCompletedSteps([1, 2]);
        }
      });
    }
  }, []);

  // Handle GitHub OAuth connection
  const handleConnectGitHub = async () => {
    setIsLoadingUser(true);
    try {
      await initiateGitHubOAuth();
    } catch (error) {
      console.error("Failed to initiate GitHub OAuth:", error);
      toast.error("Failed to connect to GitHub");
    } finally {
      setIsLoadingUser(false);
    }
  };

  // Handle repository selection from browser
  const handleRepositorySelect = async (repos: GitHubRepository[]) => {
    setSelectedRepos(repos);
    setIsConnectingRepo(true);

    try {
      // For now, we'll connect the first repository as the primary one
      // In the future, we can enhance this to support multiple repositories
      const primaryRepo = repos[0];

      // Save repository configuration
      saveRepositoryConfig({
        owner: primaryRepo.owner.login,
        repo: primaryRepo.name,
        token: githubAuth.token!,
      });

      // Initialize GitHub client
      initGithubClient(githubAuth.token!);

      // Initialize knowledge base
      toast.loading("Initializing repository...", {
        id: "init-repo",
        duration: 5000,
      });
      await initializeKnowledgeBase(true);
      toast.dismiss("init-repo");

      toast.success(
        `Connected ${repos.length} repository${
          repos.length > 1 ? "ies" : "y"
        } successfully`
      );

      // Mark step as completed and move to next step
      setCompletedSteps([1, 2, 3]);
      setCurrentStep(4);
    } catch (error) {
      console.error("Error connecting repository:", error);
      toast.error("Failed to connect repository");
    } finally {
      setIsConnectingRepo(false);
    }
  };

  // Handle manual repository connection (fallback)
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
        token: token.trim(),
      });

      // Initialize GitHub client
      initGithubClient(token.trim());

      // Initialize knowledge base
      toast.loading("Initializing repository...", {
        id: "init-repo",
        duration: 5000,
      });
      await initializeKnowledgeBase(true);
      toast.dismiss("init-repo");

      toast.success(`Repository ${owner}/${repo} connected successfully`);

      // Mark step as completed and move to next step
      setCompletedSteps([1, 2, 3]);
      setCurrentStep(4);
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
      setCompletedSteps([1, 2, 3, 4, 5]);
      onComplete();
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSkipStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onSkip();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLogoutGitHub = () => {
    logoutGitHub();
    setGithubAuth(getGitHubAuthState());
    setSelectedRepos([]);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = completedSteps.includes(stepNumber);
        const isCurrent = currentStep === stepNumber;

        return (
          <React.Fragment key={stepNumber}>
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                isCompleted
                  ? "bg-muted-foreground text-background"
                  : isCurrent
                  ? "bg-muted border border-muted-foreground text-muted-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{stepNumber}</span>
              )}
            </div>
            {index < totalSteps - 1 && (
              <div
                className={`w-8 h-px mx-2 ${
                  isCompleted ? "bg-muted-foreground" : "bg-muted"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <GitHubLogoIcon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Welcome to Unfold</h3>
              <p className="text-sm text-muted-foreground">
                Connect to your GitHub repositories to start exploring your
                codebase with AI-powered insights
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  What you can do:
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Ask questions about your codebase</li>
                  <li>• Get instant answers about features and architecture</li>
                  <li>• Understand complex code patterns and workflows</li>
                  <li>• Explore private repositories securely</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <Shield className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                Connect Your GitHub Account
              </h3>
              <p className="text-sm text-muted-foreground">
                Securely connect to your GitHub account to access your
                repositories
              </p>
            </div>

            {githubAuth.isAuthenticated ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-green-900">
                        Connected as{" "}
                        {githubAuth.user?.name || githubAuth.user?.login}
                      </h4>
                      <p className="text-sm text-green-700">
                        You can now select from your repositories
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoutGitHub}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Benefits Section */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">
                    Why connect with GitHub?
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Access your private repositories securely</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <GitBranch className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Browse all your repos in one place</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Globe className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>No need to remember exact repo URLs</span>
                    </li>
                  </ul>
                </div>

                {/* Privacy Reassurance */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-900 mb-2">
                    Your code stays private
                  </h4>
                  <p className="text-sm text-amber-800 mb-3">
                    We only read repository structure and file contents for
                    analysis. Your code never leaves your browser and is never
                    stored on our servers.
                  </p>
                  <Collapsible
                    open={isPrivacyInfoOpen}
                    onOpenChange={setIsPrivacyInfoOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-amber-700"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        Learn more about data handling
                        {isPrivacyInfoOpen ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="text-xs text-amber-700 space-y-1">
                        <p>
                          • Your GitHub token is stored only in your browser's
                          localStorage
                        </p>
                        <p>
                          • We only request read access to your repositories
                        </p>
                        <p>• You can disconnect at any time to remove access</p>
                        <p>
                          • No code or sensitive data is sent to our servers
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                <Button
                  onClick={handleConnectGitHub}
                  disabled={isLoadingUser}
                  className="w-full"
                  size="lg"
                >
                  <GitHubLogoIcon className="h-4 w-4 mr-2" />
                  {isLoadingUser ? "Connecting..." : "Connect with GitHub"}
                </Button>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">or</p>
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Continue with manual setup
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        if (githubAuth.isAuthenticated) {
          return (
            <EnhancedRepositoryBrowser
              onRepositorySelect={handleRepositorySelect}
              onBack={() => setCurrentStep(2)}
            />
          );
        } else {
          return (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <GitHubLogoIcon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="text-lg font-semibold">
                  Connect Your Repository
                </h3>
                <p className="text-sm text-muted-foreground">
                  Enter your repository details and GitHub token
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

                <Collapsible
                  open={isTokenInfoOpen}
                  onOpenChange={setIsTokenInfoOpen}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between p-2 h-auto text-left mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <Info className="h-3 w-3 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          Token Setup Instructions
                        </span>
                      </div>
                      {isTokenInfoOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm space-y-2 text-blue-800">
                        <p>
                          <strong>
                            Recommended: Fine-Grained Personal Access Tokens
                          </strong>
                        </p>
                        <p>
                          1. Go to GitHub Settings → Developer settings →
                          Personal access tokens → Fine-grained tokens
                        </p>
                        <p>
                          2. Create a new token with{" "}
                          <strong>read-only access</strong> to your repository
                        </p>
                        <p>
                          3. Grant these permissions:{" "}
                          <strong>Contents (Read)</strong> and{" "}
                          <strong>Metadata (Read)</strong>
                        </p>
                      </div>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-blue-600 text-sm mt-2"
                        onClick={() =>
                          window.open(
                            "https://github.com/settings/personal-access-tokens/new",
                            "_blank"
                          )
                        }
                      >
                        Create fine-grained token{" "}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          );
        }

      case 4:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">
                Great! You've connected {selectedRepos.length} repository
                {selectedRepos.length !== 1 ? "ies" : "y"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Your repositories have been successfully connected and scanned
              </p>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-3">
                Connected Repositories:
              </h4>
              <div className="space-y-2">
                {selectedRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between p-2 bg-white rounded border"
                  >
                    <div className="flex items-center gap-2">
                      {repo.private ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{repo.full_name}</span>
                      <Badge variant={repo.private ? "secondary" : "outline"}>
                        {repo.private ? "Private" : "Public"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Try asking questions like:</h4>
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    "How does authentication work across your connected
                    repositories?"
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    "What is the main architecture pattern used in your
                    projects?"
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    "How can I add a new feature to this project?"
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <KeyRound className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                OpenAI API Key (Optional)
              </h3>
              <p className="text-sm text-muted-foreground">
                Add your OpenAI API key to enable AI-powered code analysis and
                answers
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="api-key">OpenAI API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally and never sent to our servers
              </p>
            </div>

            <Collapsible
              open={isApiKeyInfoOpen}
              onOpenChange={setIsApiKeyInfoOpen}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between p-2 h-auto text-left"
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Why do I need an API key?
                    </span>
                  </div>
                  {isApiKeyInfoOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm space-y-2 text-blue-800">
                    <p>• AI-powered code analysis and explanations</p>
                    <p>
                      • Intelligent answer generation based on your codebase
                    </p>
                    <p>• Better understanding of complex code patterns</p>
                    <p>
                      • You can skip this step and use basic search features
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={`max-w-2xl mx-auto ${className}`}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to Unfold</CardTitle>
        <CardDescription>
          Let's get you set up to explore your codebase
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStepIndicator()}
        {renderStepContent()}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          Back
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSkipStep}>
            {currentStep === totalSteps ? "Skip" : "Skip Step"}
          </Button>

          {currentStep === 2 && githubAuth.isAuthenticated && (
            <Button onClick={() => setCurrentStep(3)}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {currentStep === 3 && !githubAuth.isAuthenticated && (
            <Button
              onClick={handleConnectRepo}
              disabled={
                isConnectingRepo ||
                !owner.trim() ||
                !repo.trim() ||
                !token.trim()
              }
            >
              {isConnectingRepo ? "Connecting..." : "Connect Repository"}
            </Button>
          )}

          {currentStep === 4 && (
            <Button onClick={() => setCurrentStep(5)}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {currentStep === 5 && (
            <Button onClick={handleSaveApiKey} disabled={isSavingApiKey}>
              {isSavingApiKey ? "Saving..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
