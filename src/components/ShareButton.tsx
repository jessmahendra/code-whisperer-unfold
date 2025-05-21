
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
  author?: string;
  authorEmail?: string;
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
      console.log("Creating shareable answer for question:", question);
      // Create shareable version
      const shareableLink = await createShareableAnswer(question, answer);
      console.log("Created shareable link:", shareableLink);
      setShareUrl(shareableLink.fullUrl);
      
      // Copy to clipboard and verify data was stored
      copyToClipboard(shareableLink.fullUrl);
      
      // Verify data was saved correctly by trying to access the data
      try {
        // Check localStorage
        const localData = localStorage.getItem('unfold_shareableAnswers');
        // Check sessionStorage as fallback
        const sessionData = sessionStorage.getItem('unfold_shareableAnswers');
        
        if ((!localData || !localData.includes(shareableLink.id)) && 
            (!sessionData || !sessionData.includes(shareableLink.id))) {
          console.error("Storage verification failed - ID not found in either storage");
          toast.error("Warning: Link created but may not persist across sessions.");
        } else {
          // Show success toast
          toast.success(
            "Link copied to clipboard! This link will work across browser sessions.",
            { duration: 5000 }
          );
        }
      } catch (verifyError) {
        console.error("Error verifying storage:", verifyError);
        toast.warning("Link created but might not work in all browsers.");
      }
    } catch (error) {
      console.error('Error sharing answer:', error);
      toast.error("Failed to create shareable link. Storage might be blocked in your browser.");
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
