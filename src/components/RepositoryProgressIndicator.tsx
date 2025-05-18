
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getExplorationProgress, setProgressUpdateCallback } from "@/services/knowledgeBase/pathExplorer";
import { getConnectionDiagnostics, getMostRelevantErrorMessage } from "@/services/githubConnector";

export default function RepositoryProgressIndicator() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "exploring" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    successfulPaths: 0
  });
  
  useEffect(() => {
    // Set the progress callback
    setProgressUpdateCallback((value) => {
      setProgress(value);
    });
    
    // Poll for progress updates
    const intervalId = setInterval(() => {
      const currentProgress = getExplorationProgress();
      
      // Update state with current progress
      setProgress(currentProgress.progress);
      setStatus(currentProgress.status);
      setErrorMessage(currentProgress.error || getMostRelevantErrorMessage());
      setStats({
        totalAttempts: currentProgress.totalAttempts,
        successfulPaths: currentProgress.successfulPaths
      });
      
      // Auto-hide the component when complete and a bit of time has passed
      if (currentProgress.status === "complete" && currentProgress.progress >= 100) {
        // Add a timer to hide the component after 5 seconds
        const hideTimer = setTimeout(() => {
          setStatus("idle");
          setProgress(0);
        }, 5000);
        
        return () => clearTimeout(hideTimer);
      }
      
      // Check for connection diagnostics
      const diagnostics = getConnectionDiagnostics();
      if (diagnostics.errors.auth && !errorMessage) {
        setErrorMessage(`Authentication error: ${diagnostics.errors.auth.message}`);
      } else if (diagnostics.errors.rateLimit && !errorMessage) {
        setErrorMessage(`Rate limit error: ${diagnostics.errors.rateLimit.message}`);
      }
    }, 500);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [errorMessage]);
  
  // Hide the indicator if we're idle and at 0%
  if (status === "idle" && progress === 0) {
    return null;
  }
  
  // Hide the indicator if we're complete and at 100% for more than 5 seconds
  if (status === "complete" && progress >= 100) {
    // We'll let the useEffect handle the hiding after 5 seconds
  }
  
  const getStatusText = () => {
    switch(status) {
      case "exploring": return "Exploring repository...";
      case "complete": return "Repository exploration complete";
      case "error": return "Repository exploration failed";
      default: return "Initializing...";
    }
  };
  
  const getStatusColor = () => {
    switch(status) {
      case "exploring": return "text-amber-500";
      case "complete": return "text-green-500";
      case "error": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between">
          <span>Repository Explorer</span>
          <span className={getStatusColor()}>{getStatusText()}</span>
        </CardTitle>
        <CardDescription>
          {stats.successfulPaths > 0 ? (
            <span>Found {stats.successfulPaths} paths with relevant code</span>
          ) : (
            <span>Searching for relevant code paths</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={progress} className="h-2" />
        
        {errorMessage && status === "error" && (
          <p className="text-xs text-red-500">{errorMessage}</p>
        )}
        
        {stats.totalAttempts > 0 && (
          <div className="text-xs text-muted-foreground">
            Attempted {stats.totalAttempts} paths, {stats.successfulPaths} successful
            {progress === 100 && stats.successfulPaths === 0 && (
              <p className="text-amber-500 mt-1">
                No relevant code paths found. Try checking your token permissions 
                or repository details.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
