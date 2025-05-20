
export interface ChatEntry {
  id: string;
  question: string;
  answer: any; // Can contain complex answer object
  timestamp: number;
}

// Store chat history in local storage
const CHAT_HISTORY_KEY = 'unfold_chat_history';

// Get all chat history entries
export function getChatHistory(): ChatEntry[] {
  try {
    const storedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (storedHistory) {
      return JSON.parse(storedHistory);
    }
  } catch (error) {
    console.error("Error retrieving chat history:", error);
  }
  return [];
}

// Add a new entry to chat history
export function addChatEntry(question: string, answer: any): ChatEntry {
  const history = getChatHistory();
  
  const newEntry: ChatEntry = {
    id: generateId(),
    question,
    answer,
    timestamp: Date.now()
  };
  
  // Add to the beginning of the array for reverse chronological order
  const updatedHistory = [newEntry, ...history];
  
  // Limit history to 50 entries to avoid localStorage size issues
  const limitedHistory = updatedHistory.slice(0, 50);
  
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
  
  return newEntry;
}

// Clear all chat history
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
}

// Helper function to generate a simple ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
