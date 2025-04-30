
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import GradientBackground from "@/components/GradientBackground";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <GradientBackground>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <BookOpen className="h-16 w-16 text-unfold-purple mb-6" />
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-md">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <Button asChild className="bg-gradient-to-r from-unfold-purple to-unfold-teal hover:opacity-90">
          <Link to="/">
            Return to Home
          </Link>
        </Button>
      </div>
    </GradientBackground>
  );
};

export default NotFound;
