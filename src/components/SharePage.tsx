import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getShareableAnswer,
  trackShare,
  ShareableAnswer,
} from "@/services/shareableAnswerService";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Twitter,
  Linkedin,
  Mail,
  ExternalLink,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import ConfidenceScore from "./ConfidenceScore";
import CodeReference from "./CodeReference";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

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
  const [retryCount, setRetryCount] = useState(0);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Logo clicked from SharePage, navigating to homepage");
    navigate("/");
  };

  const loadAnswer = async (shareId: string, attempt: number = 1) => {
    console.log(`🔍 === SHARE PAGE LOAD START (Attempt ${attempt}) ===`);
    console.log("📍 Current URL:", window.location.href);
    console.log("🆔 Share ID from params:", shareId);
    console.log("🆔 Raw useParams ID:", id);

    try {
      // Enhanced URL validation
      if (!shareId || typeof shareId !== "string" || shareId.trim() === "") {
        console.error("❌ Invalid share ID:", shareId);
        setError("Invalid share link - missing or invalid ID");
        return;
      }

      const cleanId = shareId.trim();
      console.log(`🧹 Using cleaned ID: "${cleanId}"`);

      // Add a small delay for the first attempt to ensure storage is ready
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      console.log("🔄 Calling getShareableAnswer service...");
      const sharedAnswer = getShareableAnswer(cleanId);
      console.log("📤 Service returned:", sharedAnswer);

      if (sharedAnswer) {
        console.log("✅ Successfully loaded shared answer");
        setAnswer(sharedAnswer);
        setError(null);
      } else {
        console.log(`❌ Service returned null for ID: ${cleanId}`);

        // For first few attempts, try again with a delay
        if (attempt <= 3) {
          console.log(`🔄 Retrying in ${attempt * 500}ms...`);
          setTimeout(() => {
            loadAnswer(shareId, attempt + 1);
          }, attempt * 500);
          return;
        }

        // After multiple attempts, show error
        const errorMsg = `Share ID "${cleanId}" not found. This could be because the link was created in a different browser session or the data was cleared.`;
        console.log("❌ Setting error after", attempt, "attempts:", errorMsg);
        setError(errorMsg);
      }

      console.log("🔍 === SHARE PAGE LOAD END ===");
    } catch (err) {
      console.error("💥 Error in loadAnswer:", err);
      setError("Failed to load the shared answer");
    } finally {
      setLoading(false);
    }
  };

  const retryLoadAnswer = () => {
    if (id) {
      setLoading(true);
      setError(null);
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      console.log(`🔄 Manual retry attempt ${newRetryCount}`);
      loadAnswer(id, 1);
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
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        toast.success("Link copied to clipboard");
        if (id) trackShare(id, "copy");
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
        toast.error("Failed to copy link");
      });
  };

  const handleShare = (platform: string) => {
    if (id) trackShare(id, platform);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
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
              <BookOpen className="h-6 w-6 text-black" />
              <span className="inline-block font-bold text-xl text-black">
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
                {error ||
                  "The shared answer you're looking for does not exist or is no longer available."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>This could be because:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The link was created in a different browser or device</li>
                <li>Your browser's storage was cleared or is restricted</li>
                <li>The answer has expired or was removed</li>
                <li>There was a temporary loading issue</li>
              </ul>

              <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> In this demo version, shared answers
                  are stored in your browser's storage. For a production
                  environment, a proper backend database would be used for
                  persistence.
                </p>
              </div>

              {retryCount > 0 && (
                <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Retry attempts:</strong> {retryCount}. If the issue
                    persists, the shared answer may not be available in this
                    browser.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button asChild variant="default">
                <Link to="/">Return to Home</Link>
              </Button>
              {id && (
                <Button variant="outline" onClick={retryLoadAnswer}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again {retryCount > 0 && `(${retryCount})`}
                </Button>
              )}
            </CardFooter>
          </Card>
        </main>

        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <p>
            <Link to="/" className="hover:underline">
              Unfold Knowledge Tool
            </Link>{" "}
            - Proof of Concept
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
            <BookOpen className="h-6 w-6 text-black" />
            <span className="inline-block font-bold text-xl text-black">
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
              {answer.answer.text
                .split("\n\n")
                .filter((p) => p.trim() !== "")
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>

            <div className="border-t pt-4 mt-6">
              <div className="mb-4">
                <ConfidenceScore
                  score={Math.round(answer.answer.confidence * 100)}
                />
              </div>

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
                    onClick={() => handleShare("twitter")}
                    className="flex items-center gap-1"
                    asChild
                  >
                    <a
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                        window.location.href
                      )}&text=${encodeURIComponent(answer.question)}`}
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
                    onClick={() => handleShare("linkedin")}
                    className="flex items-center gap-1"
                    asChild
                  >
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                        window.location.href
                      )}`}
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
                    onClick={() => handleShare("email")}
                    className="flex items-center gap-1"
                    asChild
                  >
                    <a
                      href={`mailto:?subject=${encodeURIComponent(
                        `Information about: ${answer.question}`
                      )}&body=${encodeURIComponent(
                        `I thought you might find this helpful:\n\n${answer.answer.text.substring(
                          0,
                          150
                        )}...\n\n${window.location.href}`
                      )}`}
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mt-4">
                Last updated: {formatDate(answer.answer.lastUpdated)} • Views:{" "}
                {answer.views}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>
          <Link to="/" className="hover:underline">
            Unfold Knowledge Tool
          </Link>{" "}
          - Proof of Concept
        </p>
      </footer>
    </div>
  );
}
