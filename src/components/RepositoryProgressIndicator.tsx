import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getExplorationProgress,
  setProgressUpdateCallback,
  getScanDiagnostics,
} from "@/services/knowledgeBase/pathExplorer";
import {
  getConnectionDiagnostics,
  getMostRelevantErrorMessage,
} from "@/services/githubConnector";
import { getEnhancedDiagnostics } from "@/services/knowledgeBase";
import { toast } from "sonner";

export default function RepositoryProgressIndicator() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "exploring" | "complete" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    successfulPaths: 0,
    filesProcessed: 0,
    scannedFiles: [] as string[],
    // Enhanced universal scanning stats
    totalFilesAvailable: 0,
    directoriesExplored: [] as string[],
    currentDirectory: "",
    scanDuration: 0,
    connectionErrors: [] as string[],
  });
  const [visible, setVisible] = useState(true);
  const [enhancedInfo, setEnhancedInfo] = useState({
    knowledgeBaseSize: 0,
    usingMockData: true,
  });

  useEffect(() => {
    toast.dismiss();

    setProgressUpdateCallback((value) => {
      setProgress(value);
    });

    // Enhanced polling with comprehensive scanning information
    const intervalId = setInterval(() => {
      const currentProgress = getExplorationProgress();
      const scanDiagnostics = getScanDiagnostics();
      const enhanced = getEnhancedDiagnostics();

      // Update state with comprehensive progress information
      setProgress(currentProgress.progress);
      setStatus(currentProgress.status);
      setErrorMessage(currentProgress.error || getMostRelevantErrorMessage());
      setStats({
        totalAttempts: currentProgress.totalAttempts,
        successfulPaths: currentProgress.successfulPaths,
        filesProcessed: currentProgress.filesProcessed,
        scannedFiles: scanDiagnostics.scannedFiles || [],
        // Enhanced universal scanning stats
        totalFilesAvailable: currentProgress.totalFilesAvailable || 0,
        directoriesExplored: currentProgress.directoriesExplored || [],
        currentDirectory: currentProgress.currentDirectory || "",
        scanDuration: currentProgress.scanDuration || 0,
        connectionErrors: currentProgress.connectionErrors || [],
      });
      setEnhancedInfo({
        knowledgeBaseSize: enhanced.knowledgeBaseSize,
        usingMockData: enhanced.usingMockData,
      });

      // Enhanced completion detection
      if (
        currentProgress.status === "complete" &&
        currentProgress.progress >= 100
      ) {
        toast.dismiss();

        // Show comprehensive completion message
        if (
          !enhanced.usingMockData &&
          scanDiagnostics.scannedFiles.length > 0
        ) {
          const successRate =
            currentProgress.totalFilesAvailable > 0
              ? Math.round(
                  (currentProgress.filesProcessed /
                    currentProgress.totalFilesAvailable) *
                    100
                )
              : 0;

          console.log(
            `Universal scan complete: ${currentProgress.filesProcessed}/${currentProgress.totalFilesAvailable} files (${successRate}% success rate)`
          );
          console.log(
            `Directories explored: ${
              currentProgress.directoriesExplored?.length || 0
            }`
          );
          console.log(`Scan duration: ${currentProgress.scanDuration || 0}ms`);
        }

        const hideTimer = setTimeout(() => {
          setVisible(false);
        }, 5000); // Show completion message longer for comprehensive scanning

        return () => clearTimeout(hideTimer);
      }

      // Enhanced error detection
      const diagnostics = getConnectionDiagnostics();
      if (diagnostics.errors.auth && !errorMessage) {
        setErrorMessage(
          `Authentication error: ${diagnostics.errors.auth.message}`
        );
      } else if (diagnostics.errors.rateLimit && !errorMessage) {
        setErrorMessage(
          `Rate limit error: ${diagnostics.errors.rateLimit.message}`
        );
      }
    }, 400);

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
    switch (status) {
      case "exploring":
        if (stats.currentDirectory) {
          return `Scanning ${stats.currentDirectory}...`;
        } else if (stats.scannedFiles.length > 0) {
          return `Universal scanning (${stats.scannedFiles.length} files found)...`;
        } else {
          return "Analyzing repository structure...";
        }
      case "complete":
        if (enhancedInfo.usingMockData) {
          return "Repository exploration complete (using sample data)";
        } else {
          const successRate =
            stats.totalFilesAvailable > 0
              ? Math.round(
                  (stats.filesProcessed / stats.totalFilesAvailable) * 100
                )
              : 0;
          return `Universal scan complete (${stats.filesProcessed}/${stats.totalFilesAvailable} files, ${successRate}% success)`;
        }
      case "error":
        return "Repository exploration failed";
      default:
        return "Initializing universal scanner...";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "exploring":
        return "text-blue-500";
      case "complete": {
        if (enhancedInfo.usingMockData) return "text-amber-500";
        const successRate =
          stats.totalFilesAvailable > 0
            ? Math.round(
                (stats.filesProcessed / stats.totalFilesAvailable) * 100
              )
            : 0;
        return successRate >= 50 ? "text-green-500" : "text-orange-500";
      }
      case "error":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getDescription = () => {
    if (status === "complete") {
      if (enhancedInfo.usingMockData) {
        return `Using sample data. Check repository connection and permissions.`;
      } else {
        const successRate =
          stats.totalFilesAvailable > 0
            ? Math.round(
                (stats.filesProcessed / stats.totalFilesAvailable) * 100
              )
            : 0;
        return `Found ${stats.directoriesExplored.length} directories with ${enhancedInfo.knowledgeBaseSize} code entries (${successRate}% success rate)`;
      }
    } else if (stats.directoriesExplored.length > 0) {
      return `Explored ${stats.directoriesExplored.length} directories, found ${stats.filesProcessed} relevant files`;
    } else if (stats.currentDirectory) {
      return `Currently scanning: ${stats.currentDirectory}`;
    } else {
      return "Discovering repository structure and relevant code paths";
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between">
          <span>Universal Repository Scanner</span>
          <span className={getStatusColor()}>{getStatusText()}</span>
        </CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={progress} className="h-2" />

        {errorMessage && status === "error" && (
          <p className="text-xs text-red-500">{errorMessage}</p>
        )}

        {/* Enhanced comprehensive statistics display */}
        {stats.totalAttempts > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            {/* Basic stats */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                Directories: {stats.directoriesExplored.length} explored
              </div>
              <div>
                Files: {stats.filesProcessed}/{stats.totalFilesAvailable}{" "}
                processed
              </div>
            </div>

            {/* Success rate and duration */}
            {stats.totalFilesAvailable > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Success Rate:{" "}
                  {Math.round(
                    (stats.filesProcessed / stats.totalFilesAvailable) * 100
                  )}
                  %
                </div>
                {stats.scanDuration > 0 && (
                  <div>Duration: {formatDuration(stats.scanDuration)}</div>
                )}
              </div>
            )}

            {/* Current directory being scanned */}
            {status === "exploring" && stats.currentDirectory && (
              <div className="text-blue-500">
                Scanning: {stats.currentDirectory}
              </div>
            )}

            {/* Connection errors */}
            {stats.connectionErrors.length > 0 && (
              <div className="text-amber-500">
                Warnings: {stats.connectionErrors.length} connection issues
              </div>
            )}

            {/* Sample of explored directories */}
            {stats.directoriesExplored.length > 0 &&
              stats.directoriesExplored.length < 8 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Directories:{" "}
                  {stats.directoriesExplored.slice(0, 5).join(", ")}
                  {stats.directoriesExplored.length > 5 && "..."}
                </div>
              )}

            {/* Sample of scanned files */}
            {stats.scannedFiles.length > 0 &&
              stats.scannedFiles.length < 10 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Sample files:{" "}
                  {stats.scannedFiles
                    .slice(0, 3)
                    .map((f) => f.split("/").pop())
                    .join(", ")}
                  {stats.scannedFiles.length > 3 && "..."}
                </div>
              )}

            {/* Warning for low success rate */}
            {progress === 100 && stats.filesProcessed < 10 && (
              <p className="text-amber-500 mt-1">
                Low file count detected. Verify repository exists and token has
                read permissions.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
