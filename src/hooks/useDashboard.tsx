
import { useState, useEffect } from 'react';

interface ChatItem {
  id: string;
  question: string;
  timestamp: string;
  isPinned: boolean;
  answer?: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  items: string[];
}

export function useDashboard() {
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [pinnedTopics, setPinnedTopics] = useState<Topic[]>([]);
  
  // Load from localStorage on first mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('unfold-chat-history');
    const savedTopics = localStorage.getItem('unfold-pinned-topics');
    
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    
    if (savedTopics) {
      try {
        setPinnedTopics(JSON.parse(savedTopics));
      } catch (e) {
        console.error('Failed to parse pinned topics', e);
      }
    }
  }, []);
  
  // Save to localStorage when state changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('unfold-chat-history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);
  
  useEffect(() => {
    if (pinnedTopics.length > 0) {
      localStorage.setItem('unfold-pinned-topics', JSON.stringify(pinnedTopics));
    }
  }, [pinnedTopics]);
  
  // Add a new chat to history
  const addChatToHistory = (question: string, answer?: string) => {
    const newChat = {
      id: Date.now().toString(),
      question,
      answer,
      timestamp: new Date().toLocaleDateString(),
      isPinned: false
    };
    
    setChatHistory(prev => [newChat, ...prev]);
    return newChat.id;
  };
  
  // Toggle pin status for a chat
  const togglePinChat = (id: string) => {
    setChatHistory(prev => 
      prev.map(item => 
        item.id === id ? { ...item, isPinned: !item.isPinned } : item
      )
    );
  };
  
  // Create a new topic
  const createTopic = (title: string, description: string) => {
    const newTopic = {
      id: Date.now().toString(),
      title,
      description,
      items: []
    };
    
    setPinnedTopics(prev => [...prev, newTopic]);
    return newTopic.id;
  };
  
  // Add question to topic
  const addToTopic = (topicId: string, question: string) => {
    setPinnedTopics(prev => 
      prev.map(topic => 
        topic.id === topicId 
          ? { ...topic, items: [...topic.items, question] }
          : topic
      )
    );
  };
  
  return {
    chatHistory,
    pinnedTopics,
    addChatToHistory,
    togglePinChat,
    createTopic,
    addToTopic
  };
}
