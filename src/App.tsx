
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SharePage from "./components/SharePage";
import SlackDemo from "./pages/SlackDemo";
import History from "./pages/History";
import Settings from "./pages/Settings";
import { BookOpen, GitBranch, Blocks, PieChart, Slack, History as HistoryIcon, Settings as SettingsIcon } from "lucide-react";

// Make the icons available globally to ensure they're imported for SharePage
// This is a workaround since we can't import them directly in the SharePage component
const icons = { BookOpen, GitBranch, Blocks, PieChart, Slack, History: HistoryIcon, Settings: SettingsIcon };

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/share/:id" element={<SharePage />} />
          <Route path="/slack-demo" element={<SlackDemo />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
