
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import ConfidenceScore from "./ConfidenceScore";
import CodeReference from "./CodeReference";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
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
  const [displayedParagraphs, setDisplayedParagraphs] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const typingSpeed = 300; // milliseconds per paragraph
  const paragraphs = answer.split('\n\n').filter(p => p.trim() !== '');
  const fullTextRef = useRef(paragraphs);

  useEffect(() => {
    fullTextRef.current = answer.split('\n\n').filter(p => p.trim() !== '');
    setParagraphIndex(0);
    setDisplayedParagraphs([]);
    setIsTyping(true);
  }, [answer]);

  useEffect(() => {
    if (!isTyping) return;

    if (paragraphIndex < fullTextRef.current.length) {
      const timeout = setTimeout(() => {
        setDisplayedParagraphs(prev => [...prev, fullTextRef.current[paragraphIndex]]);
        setParagraphIndex(prev => prev + 1);
      }, typingSpeed);

      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [paragraphIndex, isTyping]);

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(answer);
    toast.success("Answer copied to clipboard");
  };

  const handleCompleteTyping = () => {
    setDisplayedParagraphs(fullTextRef.current);
    setParagraphIndex(fullTextRef.current.length);
    setIsTyping(false);
  };
  
  const hasVersionInfo = references.some(ref => ref.lastUpdated);

  return (
    <div className="mt-8 max-w-3xl mx-auto bg-white rounded-lg shadow-md border p-6">
      <div className="mb-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-lg">{question}</h3>
          <div className="flex gap-2">
            {isTyping && (
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={handleCompleteTyping}
              >
                Complete
              </Button>
            )}
            {hasVersionInfo && (
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground text-xs flex items-center gap-1"
                onClick={() => setShowVersionInfo(!showVersionInfo)}
              >
                <Clock className="h-3 w-3" />
                {showVersionInfo ? "Hide" : "Show"} Version Info
              </Button>
            )}
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
        </div>
        <div className="text-sm space-y-4 mb-6">
          {displayedParagraphs.map((paragraph, index) => (
            <p key={index} className="animate-fade-in">
              {paragraph}
            </p>
          ))}
          {isTyping && displayedParagraphs.length < paragraphs.length && (
            <div className="flex items-center space-x-2 animate-pulse">
              <div className="h-2 w-2 bg-unfold-purple rounded-full"></div>
              <div className="h-2 w-2 bg-unfold-purple rounded-full"></div>
              <div className="h-2 w-2 bg-unfold-purple rounded-full"></div>
            </div>
          )}
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
              lastUpdated={showVersionInfo ? reference.lastUpdated : undefined}
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
