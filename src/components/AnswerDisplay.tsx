
import { useState, useEffect, useRef } from "react";
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
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);
  const typingSpeed = 15; // milliseconds per character
  const paragraphs = answer.split('\n\n');
  const fullTextRef = useRef(answer);

  useEffect(() => {
    fullTextRef.current = answer;
    setCharIndex(0);
    setDisplayedText("");
    setIsTyping(true);
  }, [answer]);

  useEffect(() => {
    if (!isTyping) return;

    if (charIndex < fullTextRef.current.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(fullTextRef.current.substring(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      }, typingSpeed);

      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [charIndex, isTyping]);

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(answer);
    toast.success("Answer copied to clipboard");
  };

  const handleCompleteTyping = () => {
    setDisplayedText(fullTextRef.current);
    setCharIndex(fullTextRef.current.length);
    setIsTyping(false);
  };

  const renderText = () => {
    const displayParagraphs = displayedText.split('\n\n');
    
    return displayParagraphs.map((paragraph, index) => (
      <p key={index} className={index < displayParagraphs.length - 1 ? "mb-4" : ""}>
        {paragraph}
        {index === displayParagraphs.length - 1 && isTyping && (
          <span className="typing-cursor"></span>
        )}
      </p>
    ));
  };

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
        <div className="text-sm space-y-0 mb-6">
          {renderText()}
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
