
export interface ChatEntry {
  id: string;
  question: string;
  answer: any; // Can contain complex answer object
  timestamp: number;
}

export interface QuestionPattern {
  question: string;
  count: number;
  lastAsked: number;
  variations: string[];
}

// Store chat history in local storage
const CHAT_HISTORY_KEY = 'unfold_chat_history';
const QUESTION_PATTERNS_KEY = 'unfold_question_patterns';

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

// Get question patterns for auto-completion
export function getQuestionPatterns(): QuestionPattern[] {
  try {
    const storedPatterns = localStorage.getItem(QUESTION_PATTERNS_KEY);
    if (storedPatterns) {
      return JSON.parse(storedPatterns);
    }
  } catch (error) {
    console.error("Error retrieving question patterns:", error);
  }
  return [];
}

// Get auto-complete suggestions based on input
export function getAutoCompleteSuggestions(input: string, limit: number = 5): string[] {
  if (!input.trim() || input.length < 2) return [];
  
  const patterns = getQuestionPatterns();
  const inputLower = input.toLowerCase();
  
  // Find questions that start with the input or contain it
  const suggestions = patterns
    .filter(pattern => 
      pattern.question.toLowerCase().includes(inputLower) ||
      pattern.variations.some(variation => variation.toLowerCase().includes(inputLower))
    )
    .sort((a, b) => b.count - a.count) // Sort by frequency
    .slice(0, limit)
    .map(pattern => pattern.question);
  
  return suggestions;
}

// Get most frequently asked questions
export function getFrequentQuestions(limit: number = 10): QuestionPattern[] {
  const patterns = getQuestionPatterns();
  return patterns
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Add a new entry to chat history and update question patterns
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
  
  // Update question patterns
  updateQuestionPatterns(question);
  
  return newEntry;
}

// Update question patterns for tracking and auto-completion
function updateQuestionPatterns(question: string): void {
  try {
    const patterns = getQuestionPatterns();
    const normalizedQuestion = normalizeQuestion(question);
    
    // Find existing pattern or create new one
    let existingPattern = patterns.find(p => 
      normalizeQuestion(p.question) === normalizedQuestion
    );
    
    if (existingPattern) {
      existingPattern.count++;
      existingPattern.lastAsked = Date.now();
      
      // Add variation if it's different
      if (!existingPattern.variations.includes(question) && existingPattern.question !== question) {
        existingPattern.variations.push(question);
      }
    } else {
      // Create new pattern
      patterns.push({
        question,
        count: 1,
        lastAsked: Date.now(),
        variations: []
      });
    }
    
    // Sort by count and limit to 100 patterns
    const sortedPatterns = patterns
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);
    
    localStorage.setItem(QUESTION_PATTERNS_KEY, JSON.stringify(sortedPatterns));
  } catch (error) {
    console.error("Error updating question patterns:", error);
  }
}

// Normalize question for pattern matching
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/[?!.]+$/, '') // Remove trailing punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Clear all chat history and patterns
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(QUESTION_PATTERNS_KEY);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
}

// Helper function to generate a simple ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
