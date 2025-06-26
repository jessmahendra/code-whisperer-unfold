import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, GitBranch, Lock, Globe, Star, Calendar } from "lucide-react";
import {
  GitHubRepository,
  fetchUserRepositories,
  getStoredToken,
  getStoredRepos,
} from "@/services/githubOAuth";
import { toast } from "sonner";

interface RepositoryBrowserProps {
  onRepositorySelect: (repo: GitHubRepository) => void;
  onBack: () => void;
}

export default function RepositoryBrowser({
  onRepositorySelect,
  onBack,
}: RepositoryBrowserProps) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepository[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterRepositories = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredRepos(repositories);
      return;
    }

    const filtered = repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRepos(filtered);
  }, [repositories, searchTerm]);

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    filterRepositories();
  }, [filterRepositories]);

  const loadRepositories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getStoredToken();
      if (!token) {
        setError("No GitHub token found. Please connect to GitHub first.");
        setIsLoading(false);
        return;
      }

      // Try to get cached repos first
      let repos = getStoredRepos();

      // If no cached repos, fetch from API
      if (repos.length === 0) {
        repos = await fetchUserRepositories(token);
      }

      setRepositories(repos);
    } catch (error) {
      console.error("Failed to load repositories:", error);
      setError("Failed to load repositories. Please try again.");
      toast.error("Failed to load repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepositorySelect = (repo: GitHubRepository) => {
    onRepositorySelect(repo);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderRepositoryCard = (repo: GitHubRepository) => (
    <Card
      key={repo.id}
      className="cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={() => handleRepositorySelect(repo)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {repo.name}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {repo.full_name}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {repo.private ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
            <Badge variant={repo.private ? "secondary" : "outline"}>
              {repo.private ? "Private" : "Public"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {repo.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {repo.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {repo.language && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>{repo.language}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              <span>{repo.default_branch}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Updated {formatDate(repo.updated_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-3" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Select a Repository</h2>
          <p className="text-muted-foreground">
            Choose a repository to analyze and explore
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadRepositories} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && renderSkeleton()}

      {/* Repositories Grid */}
      {!isLoading && !error && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredRepos.length} of {repositories.length} repositories
            </p>
            <Button variant="outline" size="sm" onClick={loadRepositories}>
              Refresh
            </Button>
          </div>

          {filteredRepos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No repositories match your search."
                  : "No repositories found."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRepos.map(renderRepositoryCard)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
