
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import ConfidenceScore from "./ConfidenceScore";
import CodeReference from "./CodeReference";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
}

interface AnswerDisplayProps {
  question: string;
  answer: string;
  confidence: number;
  references: Reference[];
  timestamp: string;
}

export default function AnswerDisplay({
  question,
  answer,
  confidence,
  references,
  timestamp,
}: AnswerDisplayProps) {
  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(answer);
    toast.success("Answer copied to clipboard");
  };

  return (
    <div className="mt-8 max-w-3xl mx-auto bg-white rounded-lg shadow-md border p-6">
      <div className="mb-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-lg">{question}</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleCopyAnswer}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
        <div className="text-sm space-y-4 mb-6">
          {answer.split('\n\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="mb-4">
          <ConfidenceScore score={confidence} />
        </div>
        <h4 className="text-sm font-medium mb-2">References</h4>
        <div className="space-y-2">
          {references.map((reference, index) => (
            <CodeReference 
              key={index} 
              filePath={reference.filePath}
              lineNumbers={reference.lineNumbers}
              snippet={reference.snippet}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-4">
          Generated on {timestamp}
        </div>
      </div>
    </div>
  );
}
