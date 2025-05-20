
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ConfidenceScore from "./ConfidenceScore";
import CodeReference from "./CodeReference";
import ShareButton from "./ShareButton";
import { Card } from "@/components/ui/card";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
}

interface VisualContext {
  type: 'flowchart' | 'component' | 'state';
  syntax: string;
}

interface AnswerDisplayProps {
  question: string;
  answer: string;
  confidence: number;
  references: Reference[];
  timestamp: string;
  visualContext?: VisualContext;
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

  // Convert confidence from 0-1 scale to 0-100 scale for the ConfidenceScore component
  const confidencePercentage = Math.round(confidence * 100);

  return (
    <div className="mt-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">{question}</h1>
      
      <div className="flex justify-end mb-2">
        <div className="flex gap-2">
          {isTyping && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleCompleteTyping}
            >
              Complete
            </Button>
          )}
          <ShareButton 
            question={question} 
            answer={{
              text: answer,
              confidence: confidence,
              references: references
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAnswer}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </div>

      <Card className="mb-4 p-6 text-left">
        <div className="text-sm space-y-4 mb-4">
          {displayedParagraphs.map((paragraph, index) => (
            <div key={index} className="animate-fade-in prose prose-sm max-w-none">
              <ReactMarkdown>{paragraph}</ReactMarkdown>
            </div>
          ))}
          {isTyping && displayedParagraphs.length < paragraphs.length && (
            <div className="flex items-center space-x-2 animate-pulse">
              <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
              <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
              <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-8">
        <h2 className="text-lg font-medium mb-4">Sources</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {/* File reference badges */}
          {Array.from(new Set(references.map(ref => ref.filePath.split('/').pop()))).map((filename, index) => (
            <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
              {filename}
            </span>
          ))}
        </div>

        <div className="space-y-2 mt-4">
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
        
        <div className="flex justify-between items-center mt-8">
          <ConfidenceScore score={confidencePercentage} />
          
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500"
            onClick={() => setShowVersionInfo(!showVersionInfo)}
          >
            {showVersionInfo ? "Hide version info" : "Show version info"}
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          Generated on {timestamp}
        </div>
      </div>
    </div>
  );
}
