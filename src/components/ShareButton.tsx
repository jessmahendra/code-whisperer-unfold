
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share, Check } from "lucide-react";
import { toast } from "sonner";
import { createShareableAnswer } from "@/services/shareableAnswerService";

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

interface ShareButtonProps {
  question: string;
  answer: {
    text: string;
    confidence: number;
    references: Reference[];
    visualContext?: VisualContext;
  };
}

export default function ShareButton({ question, answer }: ShareButtonProps) {
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  
  const handleCreateShare = async () => {
    if (shareUrl) {
      // Already have a share URL, just copy it again
      copyToClipboard(shareUrl);
      return;
    }
    
    setIsCreatingShare(true);
    
    try {
      // Create shareable version
      const shareableLink = await createShareableAnswer(question, answer);
      setShareUrl(shareableLink.fullUrl);
      
      // Copy to clipboard
      copyToClipboard(shareableLink.fullUrl);
      
      // Show info toast about session limitation
      toast.info(
        "Note: This shared link will only work in this browser session. For permanent sharing, consider taking a screenshot.",
        { duration: 5000 }
      );
    } catch (error) {
      console.error('Error sharing answer:', error);
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
      className={`text-muted-foreground text-xs flex items-center gap-1 ${isCreatingShare ? 'opacity-70' : ''}`}
      onClick={handleCreateShare}
      disabled={isCreatingShare}
    >
      {shareUrl ? (
        <Check className="h-3 w-3" />
      ) : (
        <Share className="h-3 w-3" />
      )}
      {shareUrl ? 'Copy Link' : 'Share Answer'}
    </Button>
  );
}
