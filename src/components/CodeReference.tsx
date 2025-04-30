
import { Button } from "@/components/ui/button";
import { Code2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface CodeReferenceProps {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
}

export default function CodeReference({ filePath, lineNumbers, snippet }: CodeReferenceProps) {
  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath);
    toast.success("File path copied to clipboard");
  };

  const getFileName = () => {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="bg-slate-50 border rounded-md p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Code2 className="h-4 w-4 text-muted-foreground mr-2" />
          <span className="text-sm font-medium">{getFileName()}</span>
          {lineNumbers && (
            <span className="text-xs text-muted-foreground ml-2">Lines: {lineNumbers}</span>
          )}
        </div>
        <div className="flex gap-1">
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
      <div className="text-xs overflow-auto bg-slate-100 p-3 rounded-md font-mono text-slate-700">
        <code>
          {snippet || `// File path: ${filePath}`}
        </code>
      </div>
    </div>
  );
}
