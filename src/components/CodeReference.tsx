
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Clock, User, Eye } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface CodeReferenceProps {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
  author?: string;
  authorEmail?: string;
}

export default function CodeReference({ filePath, lineNumbers, snippet, lastUpdated, author, authorEmail }: CodeReferenceProps) {
  const [showHistory, setShowHistory] = useState(false);
  
  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath);
    toast.success("File path copied to clipboard");
  };

  const getFileName = () => {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  const formatLastUpdated = () => {
    if (!lastUpdated || lastUpdated === 'Unknown') return 'Last updated: Unknown';
    try {
      return `Last updated: ${new Date(lastUpdated).toLocaleDateString()}`;
    } catch (e) {
      return `Last updated: ${lastUpdated}`;
    }
  };

  return (
    <div className="bg-slate-50 border rounded-md p-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Eye className="h-4 w-4 text-muted-foreground mr-2" />
          <span className="text-sm font-medium">{getFileName()}</span>
          {lineNumbers && (
            <span className="text-xs text-muted-foreground ml-2">Lines: {lineNumbers}</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 p-1 text-xs flex items-center gap-1"
            onClick={() => setShowHistory(!showHistory)}
          >
            <Clock className="h-3 w-3" />
            <span className="sr-only md:not-sr-only md:inline-block">History</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleCopyPath}
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy file path</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            asChild
          >
            <a 
              href={`https://github.com/TryGhost/Ghost/blob/main/${filePath}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">View on GitHub</span>
            </a>
          </Button>
        </div>
      </div>
      
      {showHistory && (lastUpdated || author) && (
        <div className="mb-2 text-xs text-muted-foreground bg-slate-100 p-2 rounded-md">
          {lastUpdated && <div>{formatLastUpdated()}</div>}
          {author && (
            <div className="flex items-center mt-1">
              <User className="h-3 w-3 mr-1" />
              <span>Author: {author}</span>
              {authorEmail && <span className="ml-1">({authorEmail})</span>}
            </div>
          )}
        </div>
      )}
      
      <div className="text-xs overflow-auto bg-slate-100 p-3 rounded-md font-mono text-slate-700">
        <code>
          {snippet || `// File path: ${filePath}`}
        </code>
      </div>
    </div>
  );
}
