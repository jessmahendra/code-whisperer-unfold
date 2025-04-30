
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface NoAnswerFallbackProps {
  question: string;
}

export default function NoAnswerFallback({ question }: NoAnswerFallbackProps) {
  return (
    <div className="mt-8 max-w-3xl mx-auto bg-white rounded-lg shadow-md border p-6">
      <div className="flex items-center mb-4 text-amber-500">
        <AlertTriangle className="h-5 w-5 mr-2" />
        <h3 className="font-medium">I couldn't find a specific answer</h3>
      </div>
      <p className="text-sm mb-4">
        I couldn't find enough information to answer your question about:
      </p>
      <div className="bg-slate-50 p-3 rounded-md mb-4 font-medium">
        {question}
      </div>
      <p className="text-sm mb-6">
        This might be because the information isn't directly in the code, or the question needs to be more specific.
      </p>
      <h4 className="text-sm font-medium mb-2">Try instead:</h4>
      <ul className="text-sm list-disc list-inside mb-4 space-y-1">
        <li>Rephrasing your question with more specific terms</li>
        <li>Breaking down your question into smaller parts</li>
        <li>Checking the official Ghost documentation</li>
      </ul>
      <div className="flex gap-2 mt-6">
        <Button
          variant="outline"
          className="text-sm"
          asChild
        >
          <a 
            href="https://ghost.org/docs/" 
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ghost Documentation
          </a>
        </Button>
        <Button
          variant="outline"
          className="text-sm"
          asChild
        >
          <a 
            href="https://forum.ghost.org/" 
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ghost Forum
          </a>
        </Button>
      </div>
    </div>
  );
}
