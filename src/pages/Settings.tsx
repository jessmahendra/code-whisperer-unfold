
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import RepositoryManager from "@/components/RepositoryManager";
import RepositoryRescan from "@/components/RepositoryRescan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, AlertCircle } from "lucide-react";
import { hasAICapabilities, wasAPIKeyPreviouslySet, getAPIKeyState } from "@/services/aiAnalysis";
import { useConnectionStatus, initializeConnection } from "@/components/ConnectionStatusManager";
import { Link } from "react-router-dom";
import { AIStatusBadge } from "@/components/AIStatusBadge";

export default function Settings() {
  const [connectionStatus, updateConnectionStatus] = useConnectionStatus();
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);

  useEffect(() => {
    // Initialize the connection to GitHub if needed
    const initialize = async () => {
      await initializeConnection(updateConnectionStatus);
      updateConnectionStatus();
    };
    initialize();

    // Poll for updates to reflect changes in connection status
    const intervalId = setInterval(() => {
      updateConnectionStatus();
    }, 300);
    return () => clearInterval(intervalId);
  }, [updateConnectionStatus]);

  const apiKeyStatus = getAPIKeyState();
  const isAIEnabled = hasAICapabilities();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold">Settings</h1>
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
          
          <div className="space-y-8">
            {/* Repository Management Section */}
            <RepositoryManager onRepositoryChange={updateConnectionStatus} />
            
            {/* Repository Scan Management Section */}
            <RepositoryRescan onScanComplete={updateConnectionStatus} />
            
            {/* AI Configuration Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  AI Configuration
                </CardTitle>
                <CardDescription>Configure AI settings to enhance answer quality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">OpenAI API Key</p>
                      <p className="text-sm text-muted-foreground">
                        {isAIEnabled 
                          ? "API Key configured" 
                          : wasAPIKeyPreviouslySet() 
                            ? "API Key needs to be re-entered" 
                            : "API Key not set"
                        }
                      </p>
                    </div>
                    
                    {/* Using the AIStatusBadge component directly */}
                    <AIStatusBadge 
                      initialOpen={isApiKeyDialogOpen} 
                      onOpenChange={setIsApiKeyDialogOpen}
                    />
                  </div>
                  
                  {apiKeyStatus?.lastError && (
                    <div className="text-sm text-red-600 mt-2">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      {apiKeyStatus.lastError}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <footer className="border-t py-4 text-sm text-muted-foreground mt-16">
        <div className="container text-center">
          <p>Currently using {connectionStatus.usingMockData ? 'mock' : 'repository'} data for knowledge base</p>
        </div>
      </footer>
    </div>
  );
}
