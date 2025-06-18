
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEnhancedDiagnostics, isUsingMockData } from "@/services/knowledgeBase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Database, FileText, Code, Settings, AlertTriangle, CheckCircle } from "lucide-react";

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

  const getStatusColor = (count: number, threshold: number) => {
    if (count >= threshold) return "text-green-600";
    if (count >= threshold / 2) return "text-yellow-600";
    return "text-red-600";
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
            Load Enhanced Diagnostics
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
    } else if (['hbs', 'handlebars'].includes(extension)) {
      fileType = 'templates';
    } else if (['json'].includes(extension)) {
      fileType = 'config';
    }
    
    acc[fileType] = (acc[fileType] || 0) + 1;
    return acc;
  }, {});

  // Enhanced analysis
  const totalFiles = diagnostics.lastScanDiagnostics.scannedFiles.length;
  const hasReadme = diagnostics.lastScanDiagnostics.scannedFiles.some((f: string) => 
    f.toLowerCase().includes('readme')
  );
  const hasGhostFiles = diagnostics.lastScanDiagnostics.scannedFiles.some((f: string) => 
    f.toLowerCase().includes('ghost') || f.toLowerCase().includes('member') || f.toLowerCase().includes('admin')
  );
  const directoryStats = diagnostics.lastScanDiagnostics.directoryStats || {};
  const skippedFiles = diagnostics.lastScanDiagnostics.skippedFiles || [];

  // Quality indicators
  const qualityScore = Math.min(100, Math.round(
    (totalFiles >= 50 ? 30 : (totalFiles / 50) * 30) + // File coverage
    (hasReadme ? 20 : 0) + // Has README
    (hasGhostFiles ? 25 : 0) + // Has Ghost-specific files
    (Object.keys(fileTypeStats).length >= 3 ? 15 : (Object.keys(fileTypeStats).length / 3) * 15) + // File diversity
    (diagnostics.knowledgeBaseSize >= 100 ? 10 : (diagnostics.knowledgeBaseSize / 100) * 10) // Knowledge density
  ));

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Enhanced Knowledge Base Diagnostics
          <Badge variant={qualityScore >= 70 ? "default" : qualityScore >= 40 ? "secondary" : "destructive"}>
            Quality Score: {qualityScore}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor(diagnostics.knowledgeBaseSize, 100)}`}>
              {diagnostics.knowledgeBaseSize}
            </div>
            <div className="text-sm text-muted-foreground">Knowledge Entries</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor(totalFiles, 50)}`}>
              {totalFiles}
            </div>
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

        {/* Quality Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded">
            {hasReadme ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
            <span className="text-sm">README Detection</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded">
            {hasGhostFiles ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-yellow-600" />}
            <span className="text-sm">Ghost-Specific Files</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded">
            {totalFiles >= 50 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-yellow-600" />}
            <span className="text-sm">Coverage Depth</span>
          </div>
        </div>

        {/* File Types Distribution */}
        <div className="space-y-2">
          <h4 className="font-semibold">File Types Distribution</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(fileTypeStats).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  {getFileTypeIcon(type)}
                  <span className="capitalize">{type}</span>
                </div>
                <Badge variant="secondary">{count as number}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Directory Statistics */}
        {Object.keys(directoryStats).length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 font-semibold">
              <ChevronRight className="h-4 w-4" />
              Directory Statistics ({Object.keys(directoryStats).length} directories)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="max-h-40 overflow-y-auto space-y-1">
                {Object.entries(directoryStats).slice(0, 20).map(([dir, fileCount]) => (
                  <div key={dir} className="flex justify-between text-sm p-1 bg-muted rounded">
                    <span className="font-mono truncate">{dir}</span>
                    <Badge variant="outline">{fileCount as number} files</Badge>
                  </div>
                ))}
                {Object.keys(directoryStats).length > 20 && (
                  <div className="text-sm text-muted-foreground">
                    ... and {Object.keys(directoryStats).length - 20} more directories
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Scanned Files */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold">
            <ChevronRight className="h-4 w-4" />
            Processed Files ({totalFiles})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {diagnostics.lastScanDiagnostics.scannedFiles.slice(0, 50).map((filePath: string, index: number) => (
                <div key={index} className="text-sm font-mono text-muted-foreground p-1 bg-muted rounded">
                  {filePath}
                </div>
              ))}
              {totalFiles > 50 && (
                <div className="text-sm text-muted-foreground">
                  ... and {totalFiles - 50} more files
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Skipped Files */}
        {skippedFiles.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-yellow-600">
              <ChevronRight className="h-4 w-4" />
              Skipped Files ({skippedFiles.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="max-h-32 overflow-y-auto space-y-1">
                {skippedFiles.slice(0, 30).map((filePath: string, index: number) => (
                  <div key={index} className="text-sm font-mono text-yellow-600 p-1 bg-yellow-50 rounded">
                    {filePath}
                  </div>
                ))}
                {skippedFiles.length > 30 && (
                  <div className="text-sm text-muted-foreground">
                    ... and {skippedFiles.length - 30} more skipped files
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recommendations */}
        {qualityScore < 70 && (
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <h5 className="font-semibold text-yellow-800">Recommendations</h5>
            <ul className="text-sm text-yellow-700 mt-2 space-y-1">
              {!hasReadme && <li>• No README file detected - this is crucial for project understanding</li>}
              {!hasGhostFiles && <li>• No Ghost-specific files found - verify repository structure</li>}
              {totalFiles < 50 && <li>• Low file coverage - consider deeper directory scanning</li>}
              {diagnostics.knowledgeBaseSize < 100 && <li>• Low knowledge density - files may not contain enough extractable content</li>}
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Last scan: {new Date(diagnostics.initializationState.lastInitTime).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
