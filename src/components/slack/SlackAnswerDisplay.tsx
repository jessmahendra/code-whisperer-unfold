
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";

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
  const [showSourceFiles, setShowSourceFiles] = useState(false);
  const typingSpeed = 500; // milliseconds per paragraph
  
  // Make sure we have a valid text content to display
  const answerText = answer && typeof answer.text === 'string' ? answer.text : "No answer available";
  const paragraphs = answerText.split('\n\n').filter(p => p.trim() !== '');
  const fullTextRef = useRef(paragraphs);

  // Get avatar for Unfold
  const avatar = (
    <div className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-r from-unfold-purple to-unfold-teal">
      U
    </div>
  );

  useEffect(() => {
    fullTextRef.current = answerText.split('\n\n').filter(p => p.trim() !== '');
    setParagraphIndex(0);
    setDisplayedParagraphs([]);
    setIsTyping(true);
  }, [answerText]);

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
  
  const handleCreateEmailTemplate = () => {
    const subject = `RE: Your Slack question`;
    const body = `Hello,

I found the answer to your question in our Slack channel:

${answer.text}

Please let me know if you need any additional information.

Best regards,
[Your Name]`;

    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open default email client
    window.open(mailtoLink);
    toast.success("Email template created");
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
          <div className="pr-3 max-h-[60vh] overflow-auto">
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
                      onClick={handleCreateEmailTemplate}
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      Email
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

                {/* Source files section */}
                {answer.references.length > 0 && (
                  <div className="mt-3 mb-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Array.from(new Set(answer.references.map(ref => ref.filePath.split('/').pop()))).map((filename, index) => (
                        <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                          {filename}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-medium">Source code:</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs py-0"
                        onClick={() => setShowSourceFiles(!showSourceFiles)}
                      >
                        {showSourceFiles ? "Hide code" : "Show code"}
                      </Button>
                    </div>
                    
                    {showSourceFiles && (
                      <div className="text-xs space-y-2">
                        {answer.references.map((ref, idx) => (
                          <div key={idx} className="bg-slate-50 p-2 rounded border">
                            <div className="font-mono text-xs text-muted-foreground mb-1">
                              {ref.filePath.split('/').pop()}
                              {ref.lineNumbers && <span className="ml-2">Lines: {ref.lineNumbers}</span>}
                              {ref.author && <span className="ml-2">by {ref.author}</span>}
                            </div>
                            <div className="p-2 bg-slate-100 rounded-md font-mono text-xs overflow-auto">
                              {ref.snippet || `// File path: ${ref.filePath}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
