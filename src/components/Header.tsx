
import { Search } from "lucide-react";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center">
            <span className="text-lg font-medium text-black">Chat</span>
          </Link>
          
          <Link to="/" className="text-gray-500 hover:text-gray-800">
            <span className="text-lg font-medium">Spaces</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center space-x-4">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Help
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
