
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getShareableAnswer, trackShare, ShareableAnswer } from "@/services/shareableAnswerService";
import { Button } from "@/components/ui/button";
import { Copy, Twitter, Linkedin, Mail, ExternalLink, BookOpen, RefreshCw } from "lucide-react";
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
  const navigate = useNavigate();
  const [answer, setAnswer] = useState<ShareableAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    hasLocalStorage: boolean;
    hasSessionStorage: boolean;
    availableIds: string[];
    searchedId: string;
    currentUrl: string;
    extractedId: string;
    storageContents: any;
  }>({
    hasLocalStorage: false,
    hasSessionStorage: false,
    availableIds: [],
    searchedId: '',
    currentUrl: '',
    extractedId: '',
    storageContents: null
  });

  // Handle logo click with explicit navigation
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Logo clicked from SharePage, navigating to homepage");
    navigate("/");
  };

  // Function to retry loading the answer
  const retryLoadAnswer = () => {
    if (id) {
      setLoading(true);
      setError(null);
      loadAnswer(id);
    }
  };

  // Separate function to load answer for reusability
  const loadAnswer = (shareId: string) => {
    try {
      console.log("🔍 === SHARE PAGE LOAD START ===");
      console.log("📍 Current URL:", window.location.href);
      console.log("🆔 Share ID from params:", shareId);
      console.log("🆔 Raw useParams ID:", id);
      
      // Get comprehensive debug information
      const STORAGE_KEY = 'unfold_shareableAnswers';
      const localData = localStorage.getItem(STORAGE_KEY);
      const sessionData = sessionStorage.getItem(STORAGE_KEY);
      
      console.log("🔑 Storage key:", STORAGE_KEY);
      console.log("📦 localStorage raw:", localData ? `${localData.length} chars` : "EMPTY");
      console.log("🗂️ sessionStorage raw:", sessionData ? `${sessionData.length} chars` : "EMPTY");
      
      let availableIds: string[] = [];
      let storageContents: any = null;
      
      // Parse and analyze localStorage
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          availableIds = Object.keys(parsed);
          storageContents = parsed;
          console.log("✅ localStorage parsed successfully");
          console.log("📋 Available IDs:", availableIds);
          console.log("📦 Full storage contents:", parsed);
          
          // Check for exact match
          if (parsed[shareId]) {
            console.log("✅ Found exact match in localStorage!");
            console.log("📄 Matched data:", parsed[shareId]);
          } else {
            console.log("❌ No exact match in localStorage");
            
            // Check for partial matches
            const partialMatches = availableIds.filter(id => 
              id.includes(shareId) || shareId.includes(id)
            );
            if (partialMatches.length > 0) {
              console.log("🔍 Partial matches found:", partialMatches);
            }
          }
        } catch (parseError) {
          console.error("💥 localStorage parse error:", parseError);
        }
      }
      
      // Parse sessionStorage if localStorage didn't work
      if (sessionData && availableIds.length === 0) {
        try {
          const parsed = JSON.parse(sessionData);
          availableIds = Object.keys(parsed);
          storageContents = parsed;
          console.log("✅ sessionStorage parsed successfully");
          console.log("📋 Available IDs:", availableIds);
          
          if (parsed[shareId]) {
            console.log("✅ Found exact match in sessionStorage!");
          } else {
            console.log("❌ No exact match in sessionStorage");
          }
        } catch (parseError) {
          console.error("💥 sessionStorage parse error:", parseError);
        }
      }
      
      // Update debug info
      setDebugInfo({
        hasLocalStorage: !!localData,
        hasSessionStorage: !!sessionData,
        availableIds,
        searchedId: shareId,
        currentUrl: window.location.href,
        extractedId: id || 'undefined',
        storageContents
      });
      
      // Try to get the answer using the service
      console.log("🔄 Calling getShareableAnswer service...");
      const sharedAnswer = getShareableAnswer(shareId);
      console.log("📤 Service returned:", sharedAnswer);
      
      if (sharedAnswer) {
        console.log("✅ Successfully loaded shared answer");
        setAnswer(sharedAnswer);
        setError(null);
      } else {
        console.log("❌ Service returned null");
        
        // Try direct access as last resort
        if (storageContents && storageContents[shareId]) {
          console.log("🔧 Found via direct access, using that");
          setAnswer(storageContents[shareId]);
          setError(null);
        } else {
          const errorMsg = availableIds.length > 0 
            ? `Share ID "${shareId}" not found. Available: ${availableIds.join(', ')}`
            : `Share ID "${shareId}" not found. No shared answers in storage.`;
          console.log("❌ Setting error:", errorMsg);
          setError(errorMsg);
        }
      }
      
      console.log("🔍 === SHARE PAGE LOAD END ===");
    } catch (err) {
      console.error("💥 Error in loadAnswer:", err);
      setError("Failed to load the shared answer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("📍 SharePage useEffect triggered");
    console.log("🆔 ID from params:", id);
    console.log("📍 Current pathname:", window.location.pathname);
    
    if (id) {
      loadAnswer(id);
    } else {
      console.error("❌ No ID found in URL params");
      setError("No share ID provided in URL");
      setLoading(false);
    }
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        toast.success("Link copied to clipboard");
        if (id) trackShare(id, 'copy');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        toast.error("Failed to copy link");
      });
  };

  const handleShare = (platform: string) => {
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
            <button 
              onClick={handleLogoClick}
              className="flex items-center space-x-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
            >
              <BookOpen className="h-6 w-6 text-unfold-purple" />
              <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
                Unfold
              </span>
            </button>
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
          <Card className="max-w-4xl mx-auto">
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
              
              {/* Enhanced debug information */}
              <div className="mt-4 rounded-md bg-gray-50 p-4 border border-gray-200">
                <p className="text-sm text-gray-700 font-medium mb-2">Detailed Debug Information:</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>Current URL:</strong> {debugInfo.currentUrl}</div>
                  <div><strong>Extracted ID from params:</strong> {debugInfo.extractedId}</div>
                  <div><strong>Searched ID:</strong> {debugInfo.searchedId || "Not provided"}</div>
                  <div><strong>localStorage available:</strong> {debugInfo.hasLocalStorage ? "Yes" : "No"}</div>
                  <div><strong>sessionStorage available:</strong> {debugInfo.hasSessionStorage ? "Yes" : "No"}</div>
                  <div><strong>Available IDs ({debugInfo.availableIds.length}):</strong></div>
                  {debugInfo.availableIds.length > 0 ? (
                    <ul className="ml-4 list-disc">
                      {debugInfo.availableIds.map(availableId => (
                        <li key={availableId}>{availableId}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ml-4 text-red-600">No shared answers found in storage</div>
                  )}
                  
                  {debugInfo.storageContents && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">Full Storage Contents</summary>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(debugInfo.storageContents, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button asChild variant="default">
                <Link to="/">Return to Home</Link>
              </Button>
              {id && (
                <Button variant="outline" onClick={retryLoadAnswer}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
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
          <button 
            onClick={handleLogoClick}
            className="flex items-center space-x-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
          >
            <BookOpen className="h-6 w-6 text-unfold-purple" />
            <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
              Unfold
            </span>
          </button>
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
