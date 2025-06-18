
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEnhancedDiagnostics, isUsingMockData } from "@/services/knowledgeBase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Database, FileText, Code, Settings } from "lucide-react";

export default function KnowledgeBaseDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const loadDiagnostics = () => {
    const data = getEnhancedDiagnostics();
    setDiagnostics(data);
    setIsOpen(true);
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'documentation':
      case 'markdown':
        return <FileText className="h-4 w-4" />;
      case 'typescript':
      case 'javascript':
        return <Code className="h-4 w-4" />;
      case 'json':
      case 'yaml':
        return <Settings className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  if (!diagnostics) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Knowledge Base Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={loadDiagnostics} variant="outline">
            Load Diagnostics
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fileTypeStats = diagnostics.lastScanDiagnostics.scannedFiles.reduce((acc: Record<string, number>, filePath: string) => {
    const extension = filePath.split('.').pop()?.toLowerCase() || 'unknown';
    let fileType = 'other';
    
    if (['md', 'mdx'].includes(extension) || filePath.toLowerCase().includes('readme')) {
      fileType = 'documentation';
    } else if (['ts', 'tsx'].includes(extension)) {
      fileType = 'typescript';
    } else if (['js', 'jsx'].includes(extension)) {
      fileType = 'javascript';
    } else if (['json'].includes(extension)) {
      fileType = 'config';
    }
    
    acc[fileType] = (acc[fileType] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Knowledge Base Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{diagnostics.knowledgeBaseSize}</div>
            <div className="text-sm text-muted-foreground">Total Entries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{diagnostics.lastScanDiagnostics.scannedFiles.length}</div>
            <div className="text-sm text-muted-foreground">Files Scanned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{Object.keys(fileTypeStats).length}</div>
            <div className="text-sm text-muted-foreground">File Types</div>
          </div>
          <div className="text-center">
            <Badge variant={diagnostics.usingMockData ? "destructive" : "default"}>
              {diagnostics.usingMockData ? "Mock Data" : "Real Data"}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">File Types Distribution</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(fileTypeStats).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  {getFileTypeIcon(type)}
                  <span className="capitalize">{type}</span>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </div>
        </div>

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold">
            <ChevronRight className="h-4 w-4" />
            Scanned Files ({diagnostics.lastScanDiagnostics.scannedFiles.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {diagnostics.lastScanDiagnostics.scannedFiles.slice(0, 50).map((filePath: string, index: number) => (
                <div key={index} className="text-sm font-mono text-muted-foreground p-1 bg-muted rounded">
                  {filePath}
                </div>
              ))}
              {diagnostics.lastScanDiagnostics.scannedFiles.length > 50 && (
                <div className="text-sm text-muted-foreground">
                  ... and {diagnostics.lastScanDiagnostics.scannedFiles.length - 50} more files
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="text-xs text-muted-foreground">
          Last scan: {new Date(diagnostics.initializationState.lastInitTime).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
