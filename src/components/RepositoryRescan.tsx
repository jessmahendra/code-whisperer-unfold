
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  getFormattedTimeUntilNextScan, 
  getLastScanDate, 
  shouldScanRepository,
  clearScanCache 
} from "@/services/scanScheduler";
import { getActiveRepository } from "@/services/userRepositories";
import { initializeKnowledgeBase, getKnowledgeBaseStats } from "@/services/knowledgeBase";

interface RepositoryRescanProps {
  onScanComplete?: () => void;
}

export default function RepositoryRescan({ onScanComplete }: RepositoryRescanProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [timeUntilNextScan, setTimeUntilNextScan] = useState<string>("");
  const [lastScanDate, setLastScanDate] = useState<Date | null>(null);
  const [shouldScan, setShouldScan] = useState(false);

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
  };

  const handleRescan = async () => {
    const activeRepo = getActiveRepository();
    if (!activeRepo) {
      toast.error("No active repository selected");
      return;
    }

    setIsScanning(true);
    try {
      toast.loading("Rescanning repository...", { id: "rescan", duration: 10000 });
      
      // Clear cache and force refresh
      clearScanCache(activeRepo.id);
      await initializeKnowledgeBase(true);
      
      toast.dismiss("rescan");
      
      const stats = getKnowledgeBaseStats();
      toast.success("Repository rescanned successfully", {
        description: `Updated knowledge base with ${stats.totalEntries} entries from ${stats.processedFiles} files`,
        duration: 4000
      });
      
      updateScanInfo();
      onScanComplete?.();
    } catch (error) {
      console.error("Error rescanning repository:", error);
      toast.error("Failed to rescan repository");
    } finally {
      setIsScanning(false);
    }
  };

  const activeRepo = getActiveRepository();
  const stats = getKnowledgeBaseStats();

  if (!activeRepo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Repository Scan
          </CardTitle>
          <CardDescription>No repository connected</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect a repository to manage scanning.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Repository Scan
        </CardTitle>
        <CardDescription>
          Manage when Unfold scans your repository for the latest code changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Last Scan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {lastScanDate ? lastScanDate.toLocaleDateString() + ' at ' + lastScanDate.toLocaleTimeString() : 'Never'}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Next Scheduled Scan</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{timeUntilNextScan}</p>
              {shouldScan && <Badge variant="outline" className="text-orange-600 border-orange-600">Scan Needed</Badge>}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="font-medium">Current Knowledge Base</span>
          <p className="text-sm text-muted-foreground">
            {stats.totalEntries} entries from {stats.processedFiles} files in {activeRepo.nickname || `${activeRepo.owner}/${activeRepo.repo}`}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="space-y-1">
            <p className="font-medium">Manual Rescan</p>
            <p className="text-sm text-muted-foreground">
              Force a fresh scan of the repository to update the knowledge base immediately
            </p>
          </div>
          
          <Button
            onClick={handleRescan}
            disabled={isScanning}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? "Scanning..." : "Rescan Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
