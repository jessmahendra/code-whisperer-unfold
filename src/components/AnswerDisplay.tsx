
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ConfidenceScore from "./ConfidenceScore";
import CodeReference from "./CodeReference";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

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

export interface AnswerDisplayProps {
  question?: string;
  answer: string | { text: string; [key: string]: any };
  confidence?: number;
  references?: Reference[];
  timestamp?: string;
  visualContext?: VisualContext;
}

export default function AnswerDisplay({
  question = "",
  answer,
  confidence = 1.0,
  references = [],
  timestamp = new Date().toLocaleString(),
  visualContext,
}: AnswerDisplayProps) {
  const [displayedParagraphs, setDisplayedParagraphs] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const typingSpeed = 300; // milliseconds per paragraph
  
  // Handle the answer text based on its type
  const answerContent = typeof answer === 'string' ? answer : 
                       (answer && typeof answer === 'object' && 'text' in answer) ? answer.text : 
                       "No answer text available";
                       
  const paragraphs = answerContent.split('\n\n').filter(p => p.trim() !== '');
  const fullTextRef = useRef(paragraphs);

  useEffect(() => {
    const content = typeof answer === 'string' ? answer : 
                   (answer && typeof answer === 'object' && 'text' in answer) ? answer.text : 
                   "No answer text available";
                   
    fullTextRef.current = content.split('\n\n').filter(p => p.trim() !== '');
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
    const textToCopy = typeof answer === 'string' ? answer : 
                      (answer && typeof answer === 'object' && 'text' in answer) ? answer.text : 
                      "No answer text available";
    navigator.clipboard.writeText(textToCopy);
    toast.success("Answer copied to clipboard");
  };

  const handleCompleteTyping = () => {
    setDisplayedParagraphs(fullTextRef.current);
    setParagraphIndex(fullTextRef.current.length);
    setIsTyping(false);
  };
  
  const handleCreateEmailTemplate = () => {
    const textAnswer = typeof answer === 'string' ? answer : 
                     (answer && typeof answer === 'object' && 'text' in answer) ? answer.text : 
                     "No answer text available";
    
    const subject = `RE: ${question || "Your inquiry"}`;
    const body = `Hello,

Thank you for reaching out with your question${question ? ` about "${question}"` : ""}.

${textAnswer}

Please let me know if you need any additional information.

Best regards,
[Your Name]`;

    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open default email client
    window.open(mailtoLink);
    toast.success("Email template created");
  };

  const hasVersionInfo = references.some(ref => ref.lastUpdated);

  // Convert confidence from 0-1 scale to 0-100 scale for the ConfidenceScore component
  const confidencePercentage = Math.round(confidence * 100);

  // Custom components for ReactMarkdown with enhanced heading styles
  const markdownComponents = {
    h1: (props: any) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
    h2: (props: any) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
    h3: (props: any) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
    h4: (props: any) => <h4 className="text-md font-semibold mt-3 mb-2" {...props} />,
    h5: (props: any) => <h5 className="text-base font-semibold mt-3 mb-1" {...props} />,
    h6: (props: any) => <h6 className="text-sm font-semibold mt-3 mb-1" {...props} />,
    ul: (props: any) => <ul className="list-disc pl-6 my-4" {...props} />,
    ol: (props: any) => <ol className="list-decimal pl-6 my-4" {...props} />,
    li: (props: any) => <li className="my-1" {...props} />
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader className="pb-0">
        {question && <h1 className="text-2xl font-semibold">{question}</h1>}
      </CardHeader>

      <CardContent className="pt-4">
        <div className="text-sm space-y-4 mb-4">
          {displayedParagraphs.map((paragraph, index) => (
            <div key={index} className="animate-fade-in prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown components={markdownComponents}>{paragraph}</ReactMarkdown>
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

        {/* Action buttons inside card */}
        <div className="flex justify-end gap-2 mt-4 border-t pt-4">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateEmailTemplate}
          >
            <Mail className="h-4 w-4 mr-1" />
            Create Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAnswer}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </CardContent>

      {references && references.length > 0 && (
        <CardFooter className="flex-col items-start border-t pt-4">
          <h2 className="text-lg font-medium mb-4">Sources</h2>
          
          {/* Always display file reference pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Array.from(new Set(references.map(ref => ref.filePath.split('/').pop()))).map((filename, index) => (
              <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                {filename}
              </span>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mb-3 text-xs"
            onClick={() => setShowReferences(!showReferences)}
          >
            {showReferences ? "Hide source code" : "Show source code"}
          </Button>
          
          {/* Show code references directly when button is clicked */}
          {showReferences && (
            <div className="space-y-3 mt-4">
              {references.map((reference, index) => (
                <CodeReference 
                  key={index} 
                  filePath={reference.filePath}
                  lineNumbers={reference.lineNumbers}
                  snippet={reference.snippet}
                  lastUpdated={showVersionInfo ? reference.lastUpdated : undefined}
                  author={reference.author}
                  authorEmail={reference.authorEmail}
                />
              ))}
            </div>
          )}
          
          <div className="flex justify-between items-center mt-8 w-full">
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
        </CardFooter>
      )}
    </Card>
  );
}
