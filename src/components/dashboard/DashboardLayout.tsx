
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageSquare, Pin, Home } from "lucide-react";
import ChatHistory from "./ChatHistory";
import PinnedTopics from "./PinnedTopics";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children
}: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState("pinned");
  
  return (
    <SidebarProvider>
      <div className="h-[calc(100vh-3.5rem)] flex w-full">
        <Sidebar>
          <SidebarHeader className="border-b">
            <Button variant="outline" className="w-full" onClick={() => setActiveTab("new")}>
              New Chat
            </Button>
          </SidebarHeader>
          
          <SidebarContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="px-2 pt-4">
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
              
              <ScrollArea className="flex-1 h-[calc(100vh-10rem)]">
                <TabsContent value="pinned" className="p-2 m-0">
                  <PinnedTopics />
                </TabsContent>
                
                <TabsContent value="history" className="p-2 m-0">
                  <ChatHistory />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </SidebarContent>
          
          <SidebarFooter className="border-t p-2">
            <div className="text-xs text-muted-foreground text-center">
              <p>Version 1.0.0</p>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 bg-white overflow-auto">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
