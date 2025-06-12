
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share, Check, Loader2 } from "lucide-react";
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
      console.log("🔗 Creating shareable answer for question:", question);
      
      // Create shareable version with enhanced verification
      const shareableLink = await createShareableAnswer(question, answer);
      console.log("✅ Created shareable link:", shareableLink);
      
      setShareUrl(shareableLink.fullUrl);
      
      // Copy to clipboard
      await copyToClipboard(shareableLink.fullUrl);
      
      // Enhanced verification
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Show success with additional context
      toast.success(
        "Shareable link created and copied to clipboard! The link will work across browser sessions.",
        { 
          duration: 6000,
          description: "You can now share this answer with others."
        }
      );
      
    } catch (error) {
      console.error('💥 Error sharing answer:', error);
      toast.error(
        "Failed to create shareable link",
        {
          description: "Storage might be blocked in your browser. Please check your privacy settings.",
          duration: 8000
        }
      );
    } finally {
      setIsCreatingShare(false);
    }
  };
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("✅ Link copied to clipboard successfully");
    } catch (err) {
      console.error('💥 Failed to copy link:', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log("✅ Link copied using fallback method");
      } catch (fallbackErr) {
        console.error('💥 Fallback copy also failed:', fallbackErr);
        throw new Error("Copy failed");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      className={`text-muted-foreground text-xs flex items-center gap-1 ${isCreatingShare ? 'opacity-70' : ''}`}
      onClick={handleCreateShare}
      disabled={isCreatingShare}
    >
      {isCreatingShare ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : shareUrl ? (
        <Check className="h-3 w-3" />
      ) : (
        <Share className="h-3 w-3" />
      )}
      {isCreatingShare ? 'Creating...' : shareUrl ? 'Copy Link' : 'Share Answer'}
    </Button>
  );
}
