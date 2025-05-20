
import { useState, useEffect } from "react";
import { getChatHistory, ChatEntry, clearChatHistory } from "@/services/chatHistoryService";
import Header from "@/components/Header";
import AnswerDisplay from "@/components/AnswerDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History as HistoryIcon } from "lucide-react";

export default function History() {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ChatEntry | null>(null);

  useEffect(() => {
    const chatHistory = getChatHistory();
    setHistory(chatHistory);
    
    // Select the most recent entry by default if available
    if (chatHistory.length > 0) {
      setSelectedEntry(chatHistory[0]);
    }
  }, []);

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your chat history? This action cannot be undone.")) {
      clearChatHistory();
      setHistory([]);
      setSelectedEntry(null);
      toast.success("Chat history cleared successfully");
    }
  };

  const formatTime = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return "Unknown time";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container py-8">
        <div className="flex items-center gap-2 mb-6">
          <HistoryIcon className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold">Chat History</h1>
        </div>
        
        {history.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-muted-foreground">No chat history found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start asking questions to build your history
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">Previous Questions</CardTitle>
                  <CardDescription>
                    {history.length} conversation{history.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end mb-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearHistory}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  </div>
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-2 pr-4">
                      {history.map((entry) => (
                        <div key={entry.id}>
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                              selectedEntry?.id === entry.id
                                ? "bg-indigo-50 border border-indigo-200"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            <p className="font-medium truncate">{entry.question}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTime(entry.timestamp)}
                            </p>
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              {selectedEntry && (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedEntry.question}</CardTitle>
                    <CardDescription>
                      {formatTime(selectedEntry.timestamp)}
                    </CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6">
                    <AnswerDisplay 
                      question={selectedEntry.question}
                      answer={selectedEntry.answer}
                      confidence={1.0}
                      references={[]}
                      timestamp={new Date(selectedEntry.timestamp).toLocaleString()}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
