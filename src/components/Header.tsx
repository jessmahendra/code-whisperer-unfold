
import { Github } from "lucide-react";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Removed "Chat" and "Spaces" text */}
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center space-x-4">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Help
            </Link>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              <Github className="h-5 w-5" />
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
