
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
import { validateGithubToken, initGithubClient } from "@/services/githubClient";
import { initializeKnowledgeBase } from "@/services/knowledgeBase";
import { saveRepositoryConfig, getRepositoryConfig, clearRepositoryConfig } from "@/services/repositoryConfig";

interface RepositoryManagerProps {
  onRepositoryChange?: () => void;
}

export default function RepositoryManager({ onRepositoryChange }: RepositoryManagerProps) {
  const [currentRepo, setCurrentRepo] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Form state
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    updateRepository();
  }, []);

  const updateRepository = () => {
    const config = getRepositoryConfig();
    setCurrentRepo(config);
  };

  const resetForm = () => {
    setOwner("");
    setRepo("");
    setToken("");
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

      // Save repository configuration
      saveRepositoryConfig({
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim()
      });
      
      // Initialize GitHub client and knowledge base
      initGithubClient(token.trim());
      toast.loading("Initializing repository...", { id: "init-repo", duration: 5000 });
      await initializeKnowledgeBase(true);
      toast.dismiss("init-repo");

      updateRepository();
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

      // Update repository configuration
      saveRepositoryConfig({
        owner: owner.trim(),
        repo: repo.trim(),
        token: token.trim()
      });
      
      // Re-initialize GitHub client and knowledge base
      initGithubClient(token.trim());
      toast.loading("Updating repository...", { id: "update-repo", duration: 3000 });
      await initializeKnowledgeBase(true);
      toast.dismiss("update-repo");
      
      updateRepository();
      setIsEditDialogOpen(false);
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

  const handleDeleteRepository = () => {
    clearRepositoryConfig();
    updateRepository();
    toast.success("Repository configuration cleared");
    onRepositoryChange?.();
  };

  const openEditDialog = () => {
    if (currentRepo) {
      setOwner(currentRepo.owner);
      setRepo(currentRepo.repo);
      setToken(currentRepo.token);
      setIsEditDialogOpen(true);
    }
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
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
              Repository Configuration
            </CardTitle>
            <CardDescription>
              Configure your GitHub repository connection
            </CardDescription>
          </div>
          
          {!currentRepo && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Repository
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Repository</DialogTitle>
                  <DialogDescription>
                    Connect a GitHub repository to use with Unfold
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
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {!currentRepo ? (
          <div className="text-center py-8">
            <GitHubLogoIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No repository connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect a GitHub repository to get started with Unfold
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              Add Repository
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 border-primary bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">
                      {currentRepo.owner}/{currentRepo.repo}
                    </h3>
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Active repository
                  </p>
                  {currentRepo.lastAccessed && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last accessed {formatDate(currentRepo.lastAccessed)}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openEditDialog}
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
                          Are you sure you want to remove "{currentRepo.owner}/{currentRepo.repo}"?
                          This will clear your current repository configuration.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteRepository}
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
          </div>
        )}
        
        {/* Edit Repository Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
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
