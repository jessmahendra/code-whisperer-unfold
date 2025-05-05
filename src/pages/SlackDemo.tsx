
import { useState } from "react";
import Header from "@/components/Header";
import SlackInterface from "@/components/slack/SlackInterface";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import GradientBackground from "@/components/GradientBackground";

export default function SlackDemo() {
  const [selectedDemo, setSelectedDemo] = useState<'support' | 'engineering' | null>(null);

  return (
    <GradientBackground>
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container py-8">
          <div className="mb-6 flex items-center">
            <Button variant="ghost" size="sm" asChild className="mr-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Unfold
              </Link>
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-unfold-purple to-unfold-teal bg-clip-text text-transparent">
              Slack Integration Demo
            </h1>
          </div>
          
          {!selectedDemo ? (
            <div className="max-w-3xl mx-auto">
              <p className="mb-8 text-lg">
                This demo simulates how Unfold could integrate with Slack, allowing team members to ask questions
                and receive instant product answers directly in their workspace.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div 
                  className="border rounded-lg p-6 hover:border-unfold-purple/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedDemo('support')}
                >
                  <h3 className="text-xl font-medium mb-3">Customer Support Demo</h3>
                  <p className="text-muted-foreground mb-4">
                    See how a support team member can quickly get product answers to help customers.
                  </p>
                  <Button>
                    Launch Support Demo
                  </Button>
                </div>
                
                <div 
                  className="border rounded-lg p-6 hover:border-unfold-purple/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedDemo('engineering')}
                >
                  <h3 className="text-xl font-medium mb-3">Engineering Team Demo</h3>
                  <p className="text-muted-foreground mb-4">
                    See how developers can query code insights directly from Slack channels.
                  </p>
                  <Button>
                    Launch Engineering Demo
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedDemo(null)}
                className="mb-4"
              >
                ← Choose another demo
              </Button>
              
              <SlackInterface scenario={selectedDemo} />
            </>
          )}
        </main>
      </div>
    </GradientBackground>
  );
}
