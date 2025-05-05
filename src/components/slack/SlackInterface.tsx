
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SlackMessage from "./SlackMessage";
import SlackAnswerDisplay from "./SlackAnswerDisplay";
import { generateAnswer } from "@/services/answerGenerator";
import { Send, Search } from "lucide-react";

// Pre-defined sample questions and conversation flows
const DEMO_SCENARIOS = {
  support: {
    channelName: "customer-support",
    teamMembers: ["Sarah (You)", "Michael", "Unfold"],
    initialMessages: [
      { 
        sender: "Michael", 
        text: "Hey team, got a customer asking about what happens when their subscription expires. Anyone know?", 
        time: "10:32 AM" 
      }
    ],
  },
  engineering: {
    channelName: "dev-ghost-integration",
    teamMembers: ["Alex (You)", "Jamie", "Unfold"],
    initialMessages: [
      { 
        sender: "Jamie", 
        text: "We need to implement the new content limit feature. Do you know if Ghost has any built-in post limits we should be aware of?", 
        time: "2:15 PM" 
      }
    ],
  }
};

interface SlackInterfaceProps {
  scenario: 'support' | 'engineering';
}

interface Message {
  sender: string;
  text: string;
  time: string;
  isAnswer?: boolean;
  answer?: any;
}

export default function SlackInterface({ scenario }: SlackInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scenarioData = DEMO_SCENARIOS[scenario];

  // Initialize with scenario messages
  useEffect(() => {
    setMessages([...scenarioData.initialMessages]);
  }, [scenario]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // Add user message
    const userMessage = {
      sender: scenarioData.teamMembers[0].split(" ")[0], // First name only
      text: newMessage,
      time: getCurrentTime()
    };
    setMessages(prev => [...prev, userMessage]);
    setNewMessage("");
    
    // Check if message mentions @unfold
    const mentionsUnfold = newMessage.toLowerCase().includes("@unfold");
    
    if (mentionsUnfold) {
      // Show typing indicator
      setIsTyping(true);
      
      // Extract the actual question by removing the @unfold mention
      const actualQuestion = newMessage.replace(/@unfold/i, "").trim();
      
      // Simulate delay for typing
      setTimeout(async () => {
        try {
          // Generate answer
          const answer = await generateAnswer(actualQuestion);
          
          if (answer) {
            // Add bot response
            setMessages(prev => [...prev, {
              sender: "Unfold",
              text: "",
              time: getCurrentTime(),
              isAnswer: true,
              answer: answer
            }]);
          } else {
            // No answer found
            setMessages(prev => [...prev, {
              sender: "Unfold",
              text: "I couldn't find specific information about that in the codebase. Would you like me to help with something else?",
              time: getCurrentTime()
            }]);
          }
        } catch (error) {
          // Error handling
          setMessages(prev => [...prev, {
            sender: "Unfold",
            text: "Sorry, I encountered an error trying to answer your question. Please try again.",
            time: getCurrentTime()
          }]);
        } finally {
          setIsTyping(false);
        }
      }, 1500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border rounded-lg bg-white shadow-md h-[80vh] flex flex-col overflow-hidden max-w-4xl mx-auto">
      {/* Slack header */}
      <div className="border-b py-2 px-4 flex items-center bg-[#350d36] text-white">
        <div className="flex-1">
          <h2 className="font-semibold text-lg">#{scenarioData.channelName}</h2>
          <p className="text-xs text-slate-300">{scenarioData.teamMembers.join(", ")}</p>
        </div>
        <div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-[#4a154b]">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#f8f8f8]">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            msg.isAnswer ? (
              <SlackAnswerDisplay 
                key={index}
                sender={msg.sender}
                time={msg.time}
                answer={msg.answer}
              />
            ) : (
              <SlackMessage
                key={index}
                sender={msg.sender}
                text={msg.text}
                time={msg.time}
                isCurrentUser={msg.sender === scenarioData.teamMembers[0].split(" ")[0]}
              />
            )
          ))}
          
          {isTyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
              <div className="flex space-x-1">
                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Unfold is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input area */}
      <div className="border-t p-3 bg-white flex items-center gap-2">
        <Input
          placeholder={`Message #${scenarioData.channelName} (try mentioning @unfold with your question)`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isTyping}
          className="flex-1"
        />
        <Button 
          onClick={handleSendMessage} 
          disabled={!newMessage.trim() || isTyping}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
