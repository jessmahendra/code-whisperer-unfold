import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getShareableAnswer, trackShare, ShareableAnswer } from "@/services/shareableAnswerService";
import { Button } from "@/components/ui/button";
import { Copy, Twitter, Linkedin, Mail, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";
import ConfidenceScore from "./ConfidenceScore";
import CodeReference from "./CodeReference";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
  author?: string;
  authorEmail?: string;
}

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate(); // Add the navigate hook
  const [answer, setAnswer] = useState<ShareableAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<{local: boolean, session: boolean}>({local: false, session: false});

  // Add function to handle logo click
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Logo clicked from SharePage, navigating to homepage");
    navigate("/", { replace: true });
  };

  useEffect(() => {
    // Load the answer data
    if (id) {
      try {
        console.log("Attempting to load shared answer with ID:", id);
        
        // Check what's in storage to aid debugging
        try {
          const localData = localStorage.getItem('unfold_shareableAnswers');
          const sessionData = sessionStorage.getItem('unfold_shareableAnswers');
          
          setStorageStatus({
            local: !!localData,
            session: !!sessionData
          });
          
          console.log("localStorage has data:", !!localData);
          console.log("sessionStorage has data:", !!sessionData);
          
          if (localData) {
            const parsed = JSON.parse(localData);
            console.log("Available IDs in localStorage:", Object.keys(parsed));
          }
          
          if (sessionData) {
            const parsed = JSON.parse(sessionData);
            console.log("Available IDs in sessionStorage:", Object.keys(parsed));
          }
        } catch (storageError) {
          console.error("Error checking storage:", storageError);
        }
        
        // Try to get the answer
        const sharedAnswer = getShareableAnswer(id);
        
        if (sharedAnswer) {
          console.log("Successfully loaded shared answer:", sharedAnswer.id);
          setAnswer(sharedAnswer);
        } else {
          console.log("No answer found for ID:", id);
          setError("The shared answer could not be found");
        }
      } catch (err) {
        console.error("Error loading shared answer:", err);
        setError("Failed to load the shared answer");
      } finally {
        setLoading(false);
      }
    }
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        toast.success("Link copied to clipboard");
        // Track the share
        if (id) trackShare(id, 'copy');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        toast.error("Failed to copy link");
      });
  };

  const handleShare = (platform: string) => {
    // Track the share
    if (id) trackShare(id, platform);
  };

  // Format date string
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="container py-16 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-64 bg-gray-200 rounded mb-8"></div>
          <div className="h-4 w-full max-w-2xl bg-gray-200 rounded mb-3"></div>
          <div className="h-4 w-full max-w-2xl bg-gray-200 rounded mb-3"></div>
          <div className="h-4 w-3/4 max-w-2xl bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!answer || error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="border-b bg-white shadow-sm">
          <div className="container flex h-16 items-center justify-between">
            {/* Updated logo to use our click handler */}
            <a 
              href="/"
              onClick={handleLogoClick}
              className="flex items-center space-x-2"
            >
              <BookOpen className="h-6 w-6 text-unfold-purple" />
              <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
                Unfold
              </span>
            </a>
            <Link 
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              Open App
            </Link>
          </div>
        </div>

        <main className="flex-1 container py-8">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Answer Not Found</CardTitle>
              <CardDescription>
                {error || "The shared answer you're looking for does not exist or is no longer available."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>This could be because:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The link is incorrect or incomplete</li>
                <li>The answer was created in a different browser or device</li>
                <li>Your browser's storage was cleared or is restricted</li>
                <li>The answer has expired or was removed</li>
              </ul>
              <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> In this current demo version, shared answers are stored in your browser's storage.
                  For a production environment, a proper backend database would be used for persistence.
                </p>
              </div>
              
              {/* Debug information */}
              <div className="mt-4 rounded-md bg-gray-50 p-4 border border-gray-200">
                <p className="text-sm text-gray-700 font-medium mb-2">Debug Information:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>ID parameter: {id || "Not provided"}</li>
                  <li>localStorage available: {storageStatus.local ? "Yes" : "No"}</li>
                  <li>sessionStorage available: {storageStatus.session ? "Yes" : "No"}</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild variant="default">
                <Link to="/">Return to Home</Link>
              </Button>
            </CardFooter>
          </Card>
        </main>
        
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <p>
            <Link to="/" className="hover:underline">
              Unfold Knowledge Tool
            </Link> - Proof of Concept
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="border-b bg-white shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          {/* Updated logo to use our click handler */}
          <a 
            href="/"
            onClick={handleLogoClick}
            className="flex items-center space-x-2"
          >
            <BookOpen className="h-6 w-6 text-unfold-purple" />
            <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
              Unfold
            </span>
          </a>
          <Link 
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="h-4 w-4" />
            Open App
          </Link>
        </div>
      </div>

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md border p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-6">{answer.question}</h1>
            
            <div className="text-sm space-y-4 mb-6">
              {answer.answer.text.split('\n\n').filter(p => p.trim() !== '').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            
            {/* Visual Context Display removed */}
            
            <div className="border-t pt-4 mt-6">
              {/* Confidence Score */}
              <div className="mb-4">
                <ConfidenceScore score={Math.round(answer.answer.confidence * 100)} />
              </div>
              
              {/* Code References */}
              <h4 className="text-sm font-medium mb-2">References</h4>
              <div className="space-y-2">
                {answer.answer.references.map((reference: Reference, index) => (
                  <CodeReference 
                    key={index} 
                    filePath={reference.filePath}
                    lineNumbers={reference.lineNumbers}
                    snippet={reference.snippet}
                    lastUpdated={reference.lastUpdated}
                    author={reference.author}
                    authorEmail={reference.authorEmail}
                  />
                ))}
              </div>
              
              {/* Share Options */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium mb-3">Share this answer</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('twitter')}
                    className="flex items-center gap-1"
                    asChild
                  >
                    <a 
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(answer.question)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </a>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('linkedin')}
                    className="flex items-center gap-1"
                    asChild
                  >
                    <a 
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </a>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('email')}
                    className="flex items-center gap-1"
                    asChild
                  >
                    <a 
                      href={`mailto:?subject=${encodeURIComponent(`Information about: ${answer.question}`)}&body=${encodeURIComponent(`I thought you might find this helpful:\n\n${answer.answer.text.substring(0, 150)}...\n\n${window.location.href}`)}`}
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground mt-4">
                Last updated: {formatDate(answer.answer.lastUpdated)}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>
          <Link to="/" className="hover:underline">
            Unfold Knowledge Tool
          </Link> - Proof of Concept
        </p>
      </footer>
    </div>
  );
}
