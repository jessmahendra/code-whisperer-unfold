
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Sparkles, AlertCircle, CheckCircle, KeyRound } from "lucide-react";
import { 
  hasAICapabilities, 
  setOpenAIApiKey,
  getAPIKeyState
} from "@/services/aiAnalysis";
import { toast } from "sonner";

interface AIStatusBadgeProps {
  className?: string;
}

export function AIStatusBadge({ className }: AIStatusBadgeProps) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const isAIEnabled = hasAICapabilities();
  const apiKeyState = getAPIKeyState();
  const hasError = !!apiKeyState.lastError;
  
  const handleSave = () => {
    if (openaiKey.trim()) {
      setOpenAIApiKey(openaiKey.trim());
      setDialogOpen(false);
      setOpenaiKey("");
    } else {
      toast.error("Please enter a valid OpenAI API key");
    }
  };
  
  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`gap-1 ${className} ${isAIEnabled ? 
              hasError ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100' : ''}`}
          >
            {isAIEnabled ? (
              hasError ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>AI Error</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-green-500" />
                  <span>AI Enabled</span>
                </>
              )
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Enable AI</span>
              </>
            )}
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>OpenAI API Key</DialogTitle>
            <DialogDescription>
              Enter your OpenAI API key to enable AI-powered code analysis and answers.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {hasError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">API Key Error</p>
                  <p className="text-red-700">{apiKeyState.lastError}</p>
                </div>
              </div>
            )}
            
            {isAIEnabled && !hasError && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm flex gap-2 items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">AI is enabled</p>
                  <p className="text-green-700">Questions will now use AI to analyze the codebase.</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="col-span-4"
              />
              <p className="text-xs text-muted-foreground">
                Your API key stays in browser memory and is never stored permanently.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleSave}>Save API Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
