
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
  author?: string;
  authorEmail?: string;
}

interface VisualContext {
  type: 'flowchart' | 'component' | 'state';
  syntax: string;
}

interface SlackAnswerDisplayProps {
  sender: string;
  time: string;
  answer: {
    text: string;
    confidence: number;
    references: Reference[];
    visualContext?: VisualContext;
  };
}

export default function SlackAnswerDisplay({ 
  sender, 
  time, 
  answer 
}: SlackAnswerDisplayProps) {
  const [displayedParagraphs, setDisplayedParagraphs] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const typingSpeed = 500; // milliseconds per paragraph
  
  const paragraphs = answer.text.split('\n\n').filter(p => p.trim() !== '');
  const fullTextRef = useRef(paragraphs);

  // Get avatar for Unfold
  const avatar = (
    <div className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-r from-unfold-purple to-unfold-teal">
      U
    </div>
  );

  useEffect(() => {
    fullTextRef.current = answer.text.split('\n\n').filter(p => p.trim() !== '');
    setParagraphIndex(0);
    setDisplayedParagraphs([]);
    setIsTyping(true);
  }, [answer.text]);

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
    navigator.clipboard.writeText(answer.text);
    toast.success("Answer copied to clipboard");
  };

  const handleCompleteTyping = () => {
    setDisplayedParagraphs(fullTextRef.current);
    setParagraphIndex(fullTextRef.current.length);
    setIsTyping(false);
  };

  // Format confidence percentage for display
  const confidencePercentage = Math.round(answer.confidence * 100);
  const confidenceLabel = 
    confidencePercentage >= 80 ? "High confidence" :
    confidencePercentage >= 50 ? "Medium confidence" : 
    "Low confidence";

  return (
    <div className="flex items-start gap-2 group text-left">
      {avatar}
      
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{sender}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        
        <div className="mt-2 p-3 border rounded-md bg-white">
          <ScrollArea className="max-h-[40vh]">
            <div className="pr-3">
              <div className="text-sm space-y-2 mb-3 text-left">
                {displayedParagraphs.map((paragraph, index) => (
                  <div key={index} className="animate-fade-in prose prose-sm max-w-none">
                    <ReactMarkdown>{paragraph}</ReactMarkdown>
                  </div>
                ))}
                {isTyping && displayedParagraphs.length < paragraphs.length && (
                  <div className="flex items-center space-x-2 animate-pulse">
                    <div className="h-2 w-2 bg-unfold-purple rounded-full"></div>
                    <div className="h-2 w-2 bg-unfold-purple rounded-full"></div>
                    <div className="h-2 w-2 bg-unfold-purple rounded-full"></div>
                  </div>
                )}
              </div>
              
              {/* Note: Visualization section removed */}
              
              {!isTyping && (
                <>
                  <div className="border-t pt-2 mt-3">
                    <div className="text-xs flex items-center mb-2">
                      <div className={`w-2 h-2 rounded-full mr-1 ${
                        confidencePercentage >= 80 ? "bg-green-500" : 
                        confidencePercentage >= 50 ? "bg-amber-500" : 
                        "bg-red-500"
                      }`}></div>
                      <span className="text-muted-foreground">
                        {confidenceLabel} ({confidencePercentage}%)
                      </span>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mb-2">
                      Based on {answer.references.length} file{answer.references.length !== 1 ? 's' : ''}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={handleCopyAnswer}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        asChild
                      >
                        <Link to="/">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open in Unfold
                        </Link>
                      </Button>
                      
                      {isTyping && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={handleCompleteTyping}
                        >
                          Complete typing
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* File references (simplified for Slack) */}
                  {answer.references.length > 0 && (
                    <div className="mt-3 mb-1">
                      <div className="text-xs font-medium mb-1">Source files:</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {answer.references.slice(0, 2).map((ref, idx) => (
                          <div key={idx} className="font-mono">
                            {ref.filePath.split('/').pop()}
                            {ref.author && <span className="ml-2 text-muted-foreground">by {ref.author}</span>}
                          </div>
                        ))}
                        {answer.references.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{answer.references.length - 2} more files
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
