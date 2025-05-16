
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { BookOpen, Code2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-unfold-purple" />
            <span className="inline-block font-bold text-xl bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">Unfold</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-4">
            <a
              href="https://github.com/TryGhost/Ghost"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-primary"
            >
              <GitHubLogoIcon className="h-5 w-5 mr-1" />
              Ghost Repo
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-primary"
            >
              <Code2 className="h-5 w-5 mr-1" />
              API Docs
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
