
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getExplorationProgress, setProgressUpdateCallback, getScanDiagnostics } from "@/services/knowledgeBase/pathExplorer";
import { getConnectionDiagnostics, getMostRelevantErrorMessage } from "@/services/githubConnector";
import { getEnhancedDiagnostics } from "@/services/knowledgeBase";
import { toast } from "sonner";

export default function RepositoryProgressIndicator() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "exploring" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    successfulPaths: 0,
    filesProcessed: 0,
    scannedFiles: [] as string[]
  });
  const [visible, setVisible] = useState(true);
  const [enhancedInfo, setEnhancedInfo] = useState({
    knowledgeBaseSize: 0,
    usingMockData: true
  });
  
  useEffect(() => {
    toast.dismiss();
    
    setProgressUpdateCallback((value) => {
      setProgress(value);
    });
    
    // Enhanced polling with more detailed information
    const intervalId = setInterval(() => {
      const currentProgress = getExplorationProgress();
      const scanDiagnostics = getScanDiagnostics();
      const enhanced = getEnhancedDiagnostics();
      
      // Update state with enhanced progress information
      setProgress(currentProgress.progress);
      setStatus(currentProgress.status);
      setErrorMessage(currentProgress.error || getMostRelevantErrorMessage());
      setStats({
        totalAttempts: currentProgress.totalAttempts,
        successfulPaths: currentProgress.successfulPaths,
        filesProcessed: currentProgress.filesProcessed,
        scannedFiles: scanDiagnostics.scannedFiles || []
      });
      setEnhancedInfo({
        knowledgeBaseSize: enhanced.knowledgeBaseSize,
        usingMockData: enhanced.usingMockData
      });
      
      // Enhanced completion detection
      if (currentProgress.status === "complete" && currentProgress.progress >= 100) {
        toast.dismiss();
        
        // Show enhanced completion message
        if (!enhanced.usingMockData && scanDiagnostics.scannedFiles.length > 0) {
          console.log(`Scan complete: ${scanDiagnostics.scannedFiles.length} files scanned, ${enhanced.knowledgeBaseSize} entries`);
        }
        
        const hideTimer = setTimeout(() => {
          setVisible(false);
        }, 3000);
        
        return () => clearTimeout(hideTimer);
      }
      
      // Enhanced error detection
      const diagnostics = getConnectionDiagnostics();
      if (diagnostics.errors.auth && !errorMessage) {
        setErrorMessage(`Authentication error: ${diagnostics.errors.auth.message}`);
      } else if (diagnostics.errors.rateLimit && !errorMessage) {
        setErrorMessage(`Rate limit error: ${diagnostics.errors.rateLimit.message}`);
      }
    }, 400); // Slightly faster polling for better UX
    
    return () => {
      clearInterval(intervalId);
    };
  }, [errorMessage]);
  
  // Enhanced visibility logic
  if (status === "idle" && progress === 0) {
    return null;
  }
  
  if (!visible) {
    return null;
  }
  
  const getStatusText = () => {
    switch(status) {
      case "exploring": 
        return stats.scannedFiles.length > 0 
          ? `Scanning repository (${stats.scannedFiles.length} files found)...`
          : "Exploring repository paths...";
      case "complete": 
        return enhancedInfo.usingMockData 
          ? "Repository exploration complete (using sample data)"
          : `Repository scan complete (${stats.scannedFiles.length} files)`;
      case "error": return "Repository exploration failed";
      default: return "Initializing enhanced scanner...";
    }
  };
  
  const getStatusColor = () => {
    switch(status) {
      case "exploring": return "text-blue-500";
      case "complete": 
        return enhancedInfo.usingMockData ? "text-amber-500" : "text-green-500";
      case "error": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };
  
  const getDescription = () => {
    if (status === "complete") {
      if (enhancedInfo.usingMockData) {
        return `Using sample data. Check repository connection and permissions.`;
      } else {
        return `Found ${stats.successfulPaths} relevant paths with ${enhancedInfo.knowledgeBaseSize} code entries`;
      }
    } else if (stats.successfulPaths > 0) {
      return `Found ${stats.successfulPaths} paths with relevant code`;
    } else {
      return "Searching for relevant code paths and files";
    }
  };
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between">
          <span>Enhanced Repository Scanner</span>
          <span className={getStatusColor()}>{getStatusText()}</span>
        </CardTitle>
        <CardDescription>
          {getDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={progress} className="h-2" />
        
        {errorMessage && status === "error" && (
          <p className="text-xs text-red-500">{errorMessage}</p>
        )}
        
        {/* Enhanced statistics display */}
        {stats.totalAttempts > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Paths: {stats.totalAttempts} attempted, {stats.successfulPaths} successful
            </div>
            {stats.scannedFiles.length > 0 && (
              <div>
                Files: {stats.scannedFiles.length} scanned, {enhancedInfo.knowledgeBaseSize} entries extracted
              </div>
            )}
            {progress === 100 && stats.successfulPaths === 0 && (
              <p className="text-amber-500 mt-1">
                No relevant code paths found. Verify repository exists and token has read permissions.
              </p>
            )}
            {/* Show sample of scanned files for debugging */}
            {stats.scannedFiles.length > 0 && stats.scannedFiles.length < 10 && (
              <div className="text-xs text-muted-foreground mt-1">
                Sample files: {stats.scannedFiles.slice(0, 3).map(f => f.split('/').pop()).join(', ')}
                {stats.scannedFiles.length > 3 && '...'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
