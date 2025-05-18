
import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import RepositoryProgressIndicator from "@/components/RepositoryProgressIndicator";

interface RepositoryStatusProps {
  bannerKey: number;
  showProgressIndicator: boolean;
  shouldShowWarningBanner: boolean;
  isConnected: boolean;
  openConfigModal: () => void;
}

export default function RepositoryStatus({
  bannerKey,
  showProgressIndicator,
  shouldShowWarningBanner,
  isConnected,
  openConfigModal
}: RepositoryStatusProps) {
  return (
    <div key={bannerKey}>
      {showProgressIndicator && <RepositoryProgressIndicator />}
      
      {shouldShowWarningBanner && (
        <div className="mb-6 p-4 border border-yellow-200 bg-yellow-50 rounded-lg text-left">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
            <div>
              <h3 className="font-medium text-yellow-800">
                {!isConnected ? "Using mock data" : "Connected but using mock data"}
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                {!isConnected
                  ? "You're currently using mock data. To connect to the Ghost GitHub repository, click the button below."
                  : "You've connected to GitHub but we're still using mock data. This might happen if the repository structure doesn't match our expectations or if your token lacks permissions."}
              </p>
              <div className="mt-2">
                <Button size="sm" variant="outline" className="bg-white" onClick={openConfigModal}>
                  <CodeIcon className="h-4 w-4 mr-1" />
                  {!isConnected ? "Configure GitHub Connection" : "Check GitHub Connection"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { CodeIcon } from "lucide-react";
