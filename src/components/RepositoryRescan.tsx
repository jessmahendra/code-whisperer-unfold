import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getFormattedTimeUntilNextScan,
  getLastScanDate,
  shouldScanRepository,
  clearScanCache,
} from "@/services/scanScheduler";
import { getActiveRepository } from "@/services/userRepositories";
import {
  getKnowledgeBaseStats,
  forceRepositoryRescan,
  getComprehensiveScanDiagnostics,
  testUniversalScanning,
  testBasicSearchFunctionality,
} from "@/services/knowledgeBase";

interface RepositoryRescanProps {
  onScanComplete?: () => void;
}

export default function RepositoryRescan({
  onScanComplete,
}: RepositoryRescanProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingBasic, setIsTestingBasic] = useState(false);
  const [timeUntilNextScan, setTimeUntilNextScan] = useState<string>("");
  const [lastScanDate, setLastScanDate] = useState<Date | null>(null);
  const [shouldScan, setShouldScan] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ReturnType<
    typeof getComprehensiveScanDiagnostics
  > | null>(null);

  useEffect(() => {
    updateScanInfo();

    // Update scan info every minute
    const interval = setInterval(updateScanInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  const updateScanInfo = () => {
    const activeRepo = getActiveRepository();
    if (!activeRepo) return;

    setTimeUntilNextScan(getFormattedTimeUntilNextScan(activeRepo.id));
    setLastScanDate(getLastScanDate(activeRepo.id));
    setShouldScan(shouldScanRepository(activeRepo.id));

    // Get comprehensive diagnostics
    const comprehensiveDiagnostics = getComprehensiveScanDiagnostics();
    setDiagnostics(comprehensiveDiagnostics);
  };

  const handleRescan = async () => {
    const activeRepo = getActiveRepository();
    if (!activeRepo) {
      toast.error("No active repository selected");
      return;
    }

    setIsScanning(true);
    try {
      toast.loading(
        "Force rescanning repository with comprehensive coverage...",
        {
          id: "rescan",
          duration: 15000,
        }
      );

      // Use the new force rescan function
      await forceRepositoryRescan();

      toast.dismiss("rescan");

      const stats = getKnowledgeBaseStats();
      const successRate =
        diagnostics?.scanProgress?.totalFilesAvailable > 0
          ? Math.round(
              (stats.processedFiles /
                diagnostics.scanProgress.totalFilesAvailable) *
                100
            )
          : 0;

      toast.success("Repository force rescanned successfully", {
        description: `Updated knowledge base with ${stats.totalEntries} entries from ${stats.processedFiles} files (${successRate}% success rate)`,
        duration: 6000,
      });

      updateScanInfo();
      onScanComplete?.();
    } catch (error) {
      console.error("Error force rescanning repository:", error);
      toast.error("Failed to force rescan repository", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestScan = async () => {
    const activeRepo = getActiveRepository();
    if (!activeRepo) {
      toast.error("No active repository selected");
      return;
    }

    setIsTesting(true);
    try {
      toast.loading("Testing universal scanning system...", {
        id: "test-scan",
        duration: 20000,
      });

      const testResults = await testUniversalScanning();

      toast.dismiss("test-scan");

      if (testResults.success) {
        toast.success("Universal scanning test passed!", {
          description: `Scanned ${testResults.filesScanned} files in ${testResults.scanDuration}ms`,
          duration: 8000,
        });
      } else {
        toast.error("Universal scanning test failed", {
          description: testResults.errors.slice(0, 2).join(", "),
          duration: 8000,
        });
      }

      // Log detailed results
      console.log("🧪 Test Results:", testResults);

      updateScanInfo();
    } catch (error) {
      console.error("Error testing universal scanning:", error);
      toast.error("Failed to test universal scanning", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestBasicSearch = async () => {
    setIsTestingBasic(true);
    try {
      toast.loading("Testing basic search functionality...", {
        id: "test-basic",
        duration: 10000,
      });

      const testResults = testBasicSearchFunctionality();

      toast.dismiss("test-basic");

      if (testResults.success) {
        toast.success("Basic search functionality test passed!", {
          description: `Found ${
            testResults.searchResults?.length || 0
          } search results`,
          duration: 8000,
        });
      } else {
        toast.error("Basic search functionality test failed", {
          description: testResults.error || "Unknown error",
          duration: 8000,
        });
      }

      // Log detailed results
      console.log("🧪 Basic Search Test Results:", testResults);
    } catch (error) {
      console.error("Error testing basic search:", error);
      toast.error("Failed to test basic search", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsTestingBasic(false);
    }
  };

  const activeRepo = getActiveRepository();
  const stats = getKnowledgeBaseStats();

  if (!activeRepo) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Repository Scanner</CardTitle>
          <CardDescription>No repository configured</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getScanStatusIcon = () => {
    if (diagnostics?.usingMockData)
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (diagnostics?.scanProgress?.filesProcessed < 10)
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getScanStatusText = () => {
    if (diagnostics?.usingMockData) return "Using Sample Data";
    if (diagnostics?.scanProgress?.filesProcessed < 10)
      return "Incomplete Scan";
    return "Scan Complete";
  };

  const getScanStatusColor = () => {
    if (diagnostics?.usingMockData) return "text-amber-500";
    if (diagnostics?.scanProgress?.filesProcessed < 10) return "text-red-500";
    return "text-green-500";
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">
              Universal Repository Scanner
            </CardTitle>
            <CardDescription>
              {activeRepo.nickname || `${activeRepo.owner}/${activeRepo.repo}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getScanStatusIcon()}
            <span className={`text-xs font-medium ${getScanStatusColor()}`}>
              {getScanStatusText()}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Enhanced scanning statistics */}
        {diagnostics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Files Scanned
              </div>
              <div className="text-sm font-semibold">
                {diagnostics.scanProgress?.filesProcessed || 0}
                {diagnostics.scanProgress?.totalFilesAvailable > 0 && (
                  <span className="text-muted-foreground">
                    /{diagnostics.scanProgress.totalFilesAvailable}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Directories
              </div>
              <div className="text-sm font-semibold">
                {diagnostics.scanProgress?.directoriesExplored?.length || 0}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Knowledge Base
              </div>
              <div className="text-sm font-semibold">
                {diagnostics.knowledgeBaseSize} entries
              </div>
            </div>
          </div>
        )}

        {/* Scan timing information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Last Scan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {lastScanDate
                ? lastScanDate.toLocaleDateString() +
                  " at " +
                  lastScanDate.toLocaleTimeString()
                : "Never"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Next Scheduled Scan</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {timeUntilNextScan}
              </p>
              {shouldScan && (
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-600"
                >
                  Scan Needed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {diagnostics?.recommendations &&
          diagnostics.recommendations.length > 0 && (
            <div className="space-y-2">
              <span className="font-medium text-sm">Recommendations</span>
              <div className="space-y-1">
                {diagnostics.recommendations.slice(0, 3).map((rec, index) => (
                  <p
                    key={index}
                    className="text-xs text-amber-600 bg-amber-50 p-2 rounded"
                  >
                    {rec}
                  </p>
                ))}
                {diagnostics.recommendations.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{diagnostics.recommendations.length - 3} more
                    recommendations
                  </p>
                )}
              </div>
            </div>
          )}

        {/* Force rescan button */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="space-y-1">
            <span className="font-medium text-sm">Force Re-scan</span>
            <p className="text-xs text-muted-foreground">
              Clear all caches and perform comprehensive repository scan
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleTestBasicSearch}
              disabled={isTestingBasic || isScanning || isTesting}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isTestingBasic ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {isTestingBasic ? "Testing..." : "Test Basic"}
            </Button>

            <Button
              onClick={handleTestScan}
              disabled={isTesting || isScanning || isTestingBasic}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isTesting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {isTesting ? "Testing..." : "Test Scan"}
            </Button>

            <Button
              onClick={handleRescan}
              disabled={isScanning || isTesting || isTestingBasic}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isScanning ? "Scanning..." : "Force Re-scan"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
