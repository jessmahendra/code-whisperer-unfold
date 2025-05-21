
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { createShareableAnswer } from "@/services/shareableAnswerService";

interface AnswerItem {
  question: string;
  answer: any;
  timestamp: string;
}

interface ShareSessionButtonProps {
  answers: AnswerItem[];
  className?: string;
}

export default function ShareSessionButton({ answers, className }: ShareSessionButtonProps) {
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  
  // Only enable the share button if there are answers to share
  const hasAnswers = answers.length > 0;
  
  const handleCreateShare = async () => {
    if (shareUrl) {
      // Already have a share URL, just copy it again
      copyToClipboard(shareUrl);
      return;
    }
    
    if (!hasAnswers) {
      toast.error("No answers to share yet");
      return;
    }
    
    setIsCreatingShare(true);
    
    try {
      // Use the first question as the main question for the shareable link
      const mainQuestion = "Q&A Session with " + answers.length + " questions";
      
      // Format all answers into a single combined answer
      const combinedAnswerText = answers.map((item, index) => {
        const answerText = typeof item.answer === 'string' ? item.answer : 
                          (item.answer && typeof item.answer === 'object' && 'text' in item.answer) ? 
                          item.answer.text : "No answer text available";
        
        return `Q${index + 1}: ${item.question}\n\nA${index + 1}: ${answerText}\n\n`;
      }).join('---\n\n');
      
      // Collect all references from all answers
      const allReferences = answers.flatMap(item => {
        return item.answer && 
               typeof item.answer === 'object' && 
               Array.isArray(item.answer.references) ? 
               item.answer.references : [];
      });
      
      // Calculate the average confidence
      const confidenceSum = answers.reduce((sum, item) => {
        const confidence = item.answer && 
                           typeof item.answer === 'object' && 
                           'confidence' in item.answer ? 
                           item.answer.confidence : 0.5;
        return sum + confidence;
      }, 0);
      
      const avgConfidence = answers.length > 0 ? confidenceSum / answers.length : 0.5;
      
      // Create a combined answer object
      const combinedAnswer = {
        text: combinedAnswerText,
        confidence: avgConfidence,
        references: allReferences
      };
      
      // Create shareable version
      const shareableLink = await createShareableAnswer(mainQuestion, combinedAnswer);
      setShareUrl(shareableLink.fullUrl);
      
      // Copy to clipboard
      copyToClipboard(shareableLink.fullUrl);
      
      toast.success(
        "All answers shared! Link copied to clipboard.",
        { duration: 5000 }
      );
    } catch (error) {
      console.error('Error sharing answers:', error);
      toast.error("Failed to create shareable link");
    } finally {
      setIsCreatingShare(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success("Link copied to clipboard!");
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        toast.error("Failed to copy link");
      });
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex items-center gap-1 ${className} ${!hasAnswers && 'opacity-50'}`}
      onClick={handleCreateShare}
      disabled={isCreatingShare || !hasAnswers}
    >
      {isCreatingShare ? (
        <div className="flex items-center gap-1">
          <div className="animate-spin h-3 w-3 border-t-2 border-primary rounded-full" />
          <span>Sharing...</span>
        </div>
      ) : shareUrl ? (
        <>
          <Link2 className="h-4 w-4" />
          <span>Copy Link</span>
        </>
      ) : (
        <>
          <Share className="h-4 w-4" />
          <span>Share All Answers</span>
        </>
      )}
    </Button>
  );
}
