import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  GitBranch,
  Lock,
  Globe,
  Plus,
  Trash2,
  Settings,
  RefreshCw,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getActiveRepository,
  getUserRepositories,
  removeUserRepository,
  UserRepository,
} from "@/services/userRepositories";
import { saveRepositoryConfig } from "@/services/repositoryConfig";
import { validateGithubToken } from "@/services/githubClient";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import {
  getGitHubAuthState,
  logoutGitHub,
  GitHubRepository,
} from "@/services/githubOAuth";
import EnhancedRepositoryBrowser from "./EnhancedRepositoryBrowser";

interface RepositoryManagerProps {
  className?: string;
}

export default function RepositoryManager({
  className = "",
}: RepositoryManagerProps) {
  const [repositories, setRepositories] = useState<UserRepository[]>([]);
  const [activeRepo, setActiveRepo] = useState<UserRepository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showOAuthBrowser, setShowOAuthBrowser] = useState(false);
  const [githubAuth, setGithubAuth] = useState(getGitHubAuthState());

  // Manual repository form state
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    setIsLoading(true);
    try {
      const userRepos = getUserRepositories();
      const active = getActiveRepository();
      setRepositories(userRepos);
      setActiveRepo(active);
      setGithubAuth(getGitHubAuthState());
    } catch (error) {
      console.error("Failed to load repositories:", error);
      toast.error("Failed to load repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRepository = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsConnecting(true);
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

      toast.success(`Repository ${owner}/${repo} added successfully`);
      setShowAddDialog(false);
      setOwner("");
      setRepo("");
      setToken("");
      loadRepositories();
    } catch (error) {
      console.error("Error adding repository:", error);
      toast.error("Failed to add repository");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveRepository = async (repoId: string) => {
    try {
      removeUserRepository(repoId);
      toast.success("Repository removed successfully");
      loadRepositories();
    } catch (error) {
      console.error("Error removing repository:", error);
      toast.error("Failed to remove repository");
    }
  };

  const handleRepositorySelect = async (selectedRepos: GitHubRepository[]) => {
    try {
      // For now, we'll add the first repository as the primary one
      // In the future, we can enhance this to support multiple repositories
      const primaryRepo = selectedRepos[0];

      // Save repository configuration
      saveRepositoryConfig({
        owner: primaryRepo.owner.login,
        repo: primaryRepo.name,
        token: githubAuth.token!,
      });

      toast.success(`Repository ${primaryRepo.full_name} added successfully`);
      setShowOAuthBrowser(false);
      loadRepositories();
    } catch (error) {
      console.error("Error adding repository:", error);
      toast.error("Failed to add repository");
    }
  };

  const handleLogoutGitHub = () => {
    logoutGitHub();
    setGithubAuth(getGitHubAuthState());
    toast.success("Disconnected from GitHub");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Repository Management</h2>
          <p className="text-muted-foreground">
            Manage your connected repositories and GitHub integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadRepositories}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* GitHub Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitHub Connection
          </CardTitle>
          <CardDescription>
            Manage your GitHub OAuth connection and repository access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubAuth.isAuthenticated ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <h4 className="font-medium text-green-900">
                  Connected as {githubAuth.user?.name || githubAuth.user?.login}
                </h4>
                <p className="text-sm text-green-700">
                  You can browse and add repositories from your GitHub account
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOAuthBrowser(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Repository
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogoutGitHub}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <h4 className="font-medium text-amber-900">
                  Not connected to GitHub
                </h4>
                <p className="text-sm text-amber-700">
                  Connect your GitHub account to easily browse and add
                  repositories
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOAuthBrowser(true)}
              >
                Connect GitHub
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Repository Addition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Repository Manually
          </CardTitle>
          <CardDescription>
            Add a repository using owner, name, and personal access token
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowAddDialog(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Repository
          </Button>
        </CardContent>
      </Card>

      {/* Connected Repositories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Connected Repositories
          </CardTitle>
          <CardDescription>
            Manage your connected repositories and their settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-muted rounded" />
                    <div>
                      <div className="h-4 w-32 bg-muted rounded mb-1" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-16 h-6 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : repositories.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No repositories connected
              </h3>
              <p className="text-muted-foreground mb-4">
                Connect your first repository to start exploring your codebase
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowOAuthBrowser(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add from GitHub
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(true)}
                >
                  Add Manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {repo.owner}/{repo.repo}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Added {formatDate(repo.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeRepo?.id === repo.id && (
                      <Badge variant="default">Active</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRepository(repo.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Repository Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Repository</DialogTitle>
            <DialogDescription>
              Enter the repository details and GitHub token to connect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label htmlFor="token">GitHub Personal Access Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="github_pat_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddRepository}
                disabled={
                  isConnecting || !owner.trim() || !repo.trim() || !token.trim()
                }
              >
                {isConnecting ? "Adding..." : "Add Repository"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* OAuth Repository Browser Dialog */}
      <Dialog open={showOAuthBrowser} onOpenChange={setShowOAuthBrowser}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Repository from GitHub</DialogTitle>
            <DialogDescription>
              Browse and select repositories from your GitHub account
            </DialogDescription>
          </DialogHeader>
          <EnhancedRepositoryBrowser
            onRepositorySelect={handleRepositorySelect}
            onBack={() => setShowOAuthBrowser(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
