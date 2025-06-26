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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  GitBranch,
  Lock,
  Globe,
  Calendar,
  ArrowRight,
} from "lucide-react";
import {
  GitHubRepository,
  fetchUserRepositories,
  getStoredToken,
  getStoredRepos,
} from "@/services/githubOAuth";
import { toast } from "sonner";

interface EnhancedRepositoryBrowserProps {
  onRepositorySelect: (repos: GitHubRepository[]) => void;
  onBack: () => void;
}

export default function EnhancedRepositoryBrowser({
  onRepositorySelect,
  onBack,
}: EnhancedRepositoryBrowserProps) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "private" | "public">(
    "all"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterRepositories = useCallback(() => {
    let filtered = repositories;

    // Apply type filter
    if (filterType === "private") {
      filtered = filtered.filter((repo) => repo.private);
    } else if (filterType === "public") {
      filtered = filtered.filter((repo) => !repo.private);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRepos(filtered);
  }, [repositories, searchTerm, filterType]);

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

      let repos = getStoredRepos();

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

  const handleSelectAll = () => {
    if (selectedRepos.size === filteredRepos.length) {
      setSelectedRepos(new Set());
    } else {
      setSelectedRepos(new Set(filteredRepos.map((repo) => repo.id)));
    }
  };

  const handleRepoToggle = (repoId: number) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepos(newSelected);
  };

  const handleContinue = () => {
    const selectedRepositories = repositories.filter((repo) =>
      selectedRepos.has(repo.id)
    );
    if (selectedRepositories.length === 0) {
      toast.error("Please select at least one repository");
      return;
    }
    onRepositorySelect(selectedRepositories);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderRepositoryCard = (repo: GitHubRepository) => (
    <Card
      key={repo.id}
      className="cursor-pointer hover:shadow-md transition-shadow duration-200"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Checkbox
              checked={selectedRepos.has(repo.id)}
              onCheckedChange={() => handleRepoToggle(repo.id)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {repo.name}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {repo.full_name}
              </CardDescription>
            </div>
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
              <div className="flex items-start gap-3 flex-1">
                <div className="w-4 h-4 bg-muted rounded mt-1" />
                <div className="flex-1">
                  <div className="h-6 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="w-16 h-6 bg-muted rounded" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-4 w-full bg-muted rounded mb-2" />
            <div className="h-4 w-3/4 bg-muted rounded mb-3" />
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
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
          <h2 className="text-2xl font-semibold">Select Repositories</h2>
          <p className="text-muted-foreground">
            Choose which repositories to connect and analyze
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters and Selection Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Filter:</span>
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "all" | "private" | "public")
                }
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="all">All</option>
                <option value="private">Private Only</option>
                <option value="public">Public Only</option>
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedRepos.size === filteredRepos.length &&
              filteredRepos.length > 0
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedRepos.size} repository
            {selectedRepos.size !== 1 ? "ies" : "y"} selected
          </div>
        </div>
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
                {searchTerm || filterType !== "all"
                  ? "No repositories match your search or filter."
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

      {/* Continue Button */}
      {!isLoading && !error && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleContinue}
            disabled={selectedRepos.size === 0}
            size="lg"
          >
            Connect {selectedRepos.size} Repository
            {selectedRepos.size !== 1 ? "ies" : "y"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
