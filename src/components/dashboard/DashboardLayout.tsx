
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, MessageSquare, Pin, Star } from "lucide-react";
import ChatHistory from "./ChatHistory";
import PinnedTopics from "./PinnedTopics";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState("main");

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      <ResizablePanelGroup direction="horizontal" className="w-full">
        {/* Sidebar */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={30} className="bg-slate-50 border-r">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center">
                <BookOpen className="h-5 w-5 mr-2 text-unfold-purple" />
                Unfold
              </h2>
            </div>
            
            <ScrollArea className="flex-1">
              <Tabs defaultValue="pinned" className="w-full">
                <div className="px-4 pt-4">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="pinned">
                      <Pin className="h-4 w-4 mr-1" />
                      Pinned
                    </TabsTrigger>
                    <TabsTrigger value="history">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      History
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="pinned" className="p-4">
                  <PinnedTopics />
                </TabsContent>
                
                <TabsContent value="history" className="p-4">
                  <ChatHistory />
                </TabsContent>
              </Tabs>
            </ScrollArea>
            
            <div className="p-4 border-t mt-auto">
              <Button variant="outline" className="w-full" onClick={() => setActiveTab("new")}>
                New Chat
              </Button>
            </div>
          </div>
        </ResizablePanel>
        
        {/* Resize handle */}
        <ResizableHandle withHandle />
        
        {/* Main content */}
        <ResizablePanel defaultSize={75}>
          <div className="h-full bg-white overflow-auto">
            {children}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
