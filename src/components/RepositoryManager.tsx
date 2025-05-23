
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Trash2, Edit, Plus, Star, StarOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getUserRepositories,
  saveUserRepository,
  removeUserRepository,
  getActiveRepository,
  setActiveRepository,
  type UserRepository
} from "@/services/userRepositories";
import { validateGithubToken, initGithubClient } from "@/services/githubClient";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";

interface RepositoryManagerProps {
  onRepositoryChange?: () => void;
}

export default function RepositoryManager({ onRepositoryChange }: RepositoryManagerProps) {
  const [repositories, setRepositories] = useState<UserRepository[]>([]);
  const [activeRepo, setActiveRepo] = useState<UserRepository | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<UserRepository | null>(null);
  
  // Form state
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    updateRepositories();
  }, []);

  const updateRepositories = () => {
    const repos = getUserRepositories();
    const active = getActiveRepository();
    
    setRepositories(repos);
    setActiveRepo(active);
  };

  const resetForm = () => {
    setOwner("");
    setRepo("");
    setToken("");
    setNickname("");
  };

  const handleAddRepository = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate token first
      const user = await validateGithubToken(token);
      if (!user) {
        toast.error("Invalid GitHub token");
        return;
      }

      // Save repository
      const newRepo = saveUserRepository(owner.trim(), repo.trim(), token.trim(), nickname.trim() || undefined);
      
      // If this is the first repository, make it active
      if (repositories.length === 0) {
        setActiveRepository(newRepo.id);
        
        // Initialize GitHub client and knowledge base
        initGithubClient(newRepo.token);
        toast.loading("Initializing repository...", { id: "init-repo", duration: 5000 });
        await initializeKnowledgeBase(true);
        toast.dismiss("init-repo");
      }

      updateRepositories();
      setIsAddDialogOpen(false);
      resetForm();
      
      toast.success(`Repository ${owner}/${repo} added successfully`);
      onRepositoryChange?.();
    } catch (error) {
      console.error("Error adding repository:", error);
      toast.error("Failed to add repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRepository = async () => {
    if (!editingRepo || !owner.trim() || !repo.trim() || !token.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate token first
      const user = await validateGithubToken(token);
      if (!user) {
        toast.error("Invalid GitHub token");
        return;
      }

      // Update repository
      saveUserRepository(owner.trim(), repo.trim(), token.trim(), nickname.trim() || undefined);
      
      updateRepositories();
      setEditingRepo(null);
      resetForm();
      
      toast.success("Repository updated successfully");
      onRepositoryChange?.();
    } catch (error) {
      console.error("Error updating repository:", error);
      toast.error("Failed to update repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRepository = (repoId: string) => {
    removeUserRepository(repoId);
    updateRepositories();
    toast.success("Repository removed");
    onRepositoryChange?.();
  };

  const handleSetActive = async (repo: UserRepository) => {
    try {
      setActiveRepository(repo.id);
      
      // Initialize GitHub client and knowledge base
      initGithubClient(repo.token);
      toast.loading("Switching repository...", { id: "switch-repo", duration: 3000 });
      await initializeKnowledgeBase(true);
      toast.dismiss("switch-repo");
      
      updateRepositories();
      toast.success(`Switched to ${repo.nickname || `${repo.owner}/${repo.repo}`}`);
      onRepositoryChange?.();
    } catch (error) {
      console.error("Error switching repository:", error);
      toast.error("Failed to switch repository");
    }
  };

  const openEditDialog = (repo: UserRepository) => {
    setEditingRepo(repo);
    setOwner(repo.owner);
    setRepo(repo.repo);
    setToken(repo.token);
    setNickname(repo.nickname || "");
  };

  const closeEditDialog = () => {
    setEditingRepo(null);
    resetForm();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitHubLogoIcon className="h-5 w-5" />
              Repository Management
            </CardTitle>
            <CardDescription>
              Manage your connected GitHub repositories
            </CardDescription>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Repository
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Repository</DialogTitle>
                <DialogDescription>
                  Connect a new GitHub repository to use with Unfold
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-owner">Repository Owner</Label>
                    <Input
                      id="add-owner"
                      placeholder="e.g., TryGhost"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-repo">Repository Name</Label>
                    <Input
                      id="add-repo"
                      placeholder="e.g., Ghost"
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="add-nickname">Nickname (Optional)</Label>
                  <Input
                    id="add-nickname"
                    placeholder="e.g., Ghost CMS"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="add-token">GitHub Personal Access Token</Label>
                  <Input
                    id="add-token"
                    type="password"
                    placeholder="ghp_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddRepository} disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Repository"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {repositories.length === 0 ? (
          <div className="text-center py-8">
            <GitHubLogoIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No repositories connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your first GitHub repository to get started with Unfold
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              Add Your First Repository
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {repositories.map((repository) => (
              <div
                key={repository.id}
                className={`border rounded-lg p-4 ${
                  activeRepo?.id === repository.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">
                        {repository.nickname || `${repository.owner}/${repository.repo}`}
                      </h3>
                      {activeRepo?.id === repository.id && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {repository.owner}/{repository.repo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {formatDate(repository.createdAt)} • Last used {formatDate(repository.lastUsed)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {activeRepo?.id !== repository.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActive(repository)}
                      >
                        <StarOff className="h-4 w-4 mr-1" />
                        Set Active
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(repository)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Repository</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{repository.nickname || `${repository.owner}/${repository.repo}`}"?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteRepository(repository.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Edit Repository Dialog */}
        <Dialog open={editingRepo !== null} onOpenChange={(open) => !open && closeEditDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Repository</DialogTitle>
              <DialogDescription>
                Update repository information
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-owner">Repository Owner</Label>
                  <Input
                    id="edit-owner"
                    placeholder="e.g., TryGhost"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-repo">Repository Name</Label>
                  <Input
                    id="edit-repo"
                    placeholder="e.g., Ghost"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-nickname">Nickname (Optional)</Label>
                <Input
                  id="edit-nickname"
                  placeholder="e.g., Ghost CMS"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-token">GitHub Personal Access Token</Label>
                <Input
                  id="edit-token"
                  type="password"
                  placeholder="ghp_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button onClick={handleEditRepository} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Repository"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
