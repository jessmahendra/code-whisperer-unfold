
import { useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { KeyRound, AlertCircle } from "lucide-react";
import { hasAICapabilities, wasAPIKeyPreviouslySet, getAPIKeyState } from "@/services/aiAnalysis";
import { getCurrentRepository, getConnectionDiagnostics, getMostRelevantErrorMessage } from "@/services/githubConnector";
import { isUsingMockData } from "@/services/knowledgeBase";
import { useConnectionStatus, initializeConnection } from "@/components/ConnectionStatusManager";
import { Link } from "react-router-dom";

export default function Settings() {
  const [connectionStatus, updateConnectionStatus] = useConnectionStatus();

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

  // Find the GitHub connection button from Header
  const openGhostConnectDialog = () => {
    // Find and click the connect to ghost button in the header
    const ghostButton = document.querySelector('header button:has(.h-4.w-4)') as HTMLButtonElement;
    if (ghostButton) {
      ghostButton.click();
    }
  };

  // Find the API key dialog from Header
  const openAPIKeyDialog = () => {
    // Find and click the API key button in the header
    const apiKeyButton = document.querySelector('header button:has(.KeyRound)') as HTMLButtonElement;
    if (apiKeyButton) {
      apiKeyButton.click();
    }
  };

  // Get repository info
  const currentRepo = getCurrentRepository();
  const isConnected = currentRepo !== null;
  const usingMockData = isUsingMockData();
  const diagnostics = getConnectionDiagnostics();
  const apiKeyStatus = getAPIKeyState();
  const isAIEnabled = hasAICapabilities();
  
  // Get the most relevant error message if any
  const errorMessage = getMostRelevantErrorMessage();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold">Settings</h1>
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
          
          <div className="space-y-8">
            {/* GitHub Connection Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitHubLogoIcon className="h-5 w-5" />
                  GitHub Repository Connection
                </CardTitle>
                <CardDescription>Connect to the Ghost CMS repository to retrieve accurate information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Status</p>
                      <p className="text-sm text-muted-foreground">
                        {isConnected 
                          ? usingMockData 
                            ? "Connected with mock data" 
                            : "Fully connected"
                          : "Not connected"
                        }
                      </p>
                    </div>
                    <Button 
                      onClick={openGhostConnectDialog}
                      variant={isConnected && !usingMockData ? "outline" : "default"}
                      className="flex items-center gap-1"
                    >
                      <GitHubLogoIcon className="h-4 w-4" />
                      {isConnected ? "Reconnect" : "Connect to Ghost"}
                    </Button>
                  </div>
                  
                  {currentRepo && (
                    <div>
                      <p className="font-medium">Repository</p>
                      <p className="text-sm text-muted-foreground">
                        {currentRepo.owner}/{currentRepo.repo}
                      </p>
                    </div>
                  )}
                  
                  {errorMessage && (
                    <div className="text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      {errorMessage}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
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
                    <Button
                      onClick={openAPIKeyDialog}
                      variant={isAIEnabled ? "outline" : "default"}
                      className={`flex items-center gap-1 ${apiKeyStatus?.lastError ? 'bg-red-50 border-red-200' : ''}`}
                    >
                      <KeyRound className="h-4 w-4" />
                      {isAIEnabled ? "Update API Key" : "Set API Key"}
                    </Button>
                  </div>
                  
                  {apiKeyStatus?.lastError && (
                    <div className="text-sm text-red-600">
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
