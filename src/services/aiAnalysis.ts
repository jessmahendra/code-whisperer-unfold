// AI Analysis Service to enhance repository search with OpenAI
import { toast } from "sonner";

// Store the OpenAI API key in memory (not persisted for security reasons)
let openaiApiKey: string | null = null;
let apiKeyState = {
  lastError: null as string | null,
  lastUsed: 0 as number,
  failedAttempts: 0 as number
};

// LocalStorage key for API key (storing encrypted version)
const OPENAI_API_KEY_STORAGE_KEY = 'unfold_openai_api_key';

/**
 * Simple encryption function for API key
 * Note: This is NOT secure encryption, just basic obfuscation
 */
function encryptKey(key: string): string {
  return btoa(key.split('').reverse().join(''));
}

/**
 * Simple decryption function for API key
 */
function decryptKey(encryptedKey: string): string {
  try {
    return atob(encryptedKey).split('').reverse().join('');
  } catch (e) {
    console.error("Failed to decrypt API key");
    return "";
  }
}

/**
 * Load the OpenAI API key from localStorage on startup
 */
function loadApiKeyFromStorage(): void {
  try {
    const encryptedKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    if (encryptedKey) {
      openaiApiKey = decryptKey(encryptedKey);
      console.log("OpenAI API key loaded from storage");
      
      // Clear any previous errors when loading from storage
      apiKeyState.lastError = null;
      apiKeyState.failedAttempts = 0;
    }
  } catch (e) {
    console.error("Could not load API key from localStorage", e);
  }
}

// Load API key on module initialization
loadApiKeyFromStorage();

/**
 * Set the OpenAI API key
 * @param key - The OpenAI API key
 */
export function setOpenAIApiKey(key: string): void {
  if (!key.trim()) {
    toast.error("API key cannot be empty");
    return;
  }
  
  // Basic validation check for OpenAI key format
  if (!key.startsWith('sk-')) {
    toast.warning("API key doesn't match expected OpenAI key format", {
      description: "OpenAI keys usually start with 'sk-'. Check your API key."
    });
    // Still save it since we don't want to block users with special cases
  }
  
  openaiApiKey = key;
  apiKeyState.lastError = null;
  apiKeyState.failedAttempts = 0;
  
  // Save an encrypted version to localStorage
  try {
    const encryptedKey = encryptKey(key);
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, encryptedKey);
    localStorage.setItem('openai_key_set', 'true');
  } catch (e) {
    console.error("Could not save API key to localStorage", e);
  }
  
  toast.success("OpenAI API key has been set successfully", {
    description: "AI-powered analysis is now available."
  });
}

/**
 * Check if the AI capabilities are enabled
 * @returns Boolean indicating if AI analysis is available
 */
export function hasAICapabilities(): boolean {
  return openaiApiKey !== null;
}

/**
 * Check if an API key has been previously set
 * @returns Boolean indicating if a key was previously set
 */
export function wasAPIKeyPreviouslySet(): boolean {
  try {
    return localStorage.getItem('openai_key_set') === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Get the OpenAI API key
 * @returns The OpenAI API key or null if not set
 */
export function getOpenAIApiKey(): string | null {
  return openaiApiKey;
}

/**
 * Get the current API key state
 * @returns Information about API key usage and errors
 */
export function getAPIKeyState(): typeof apiKeyState {
  return { ...apiKeyState };
}

/**
 * Clear the OpenAI API key
 */
export function clearOpenAIApiKey(): void {
  openaiApiKey = null;
  apiKeyState = {
    lastError: null,
    lastUsed: 0,
    failedAttempts: 0
  };
  
  try {
    localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    localStorage.removeItem('openai_key_set');
  } catch (e) {
    console.error("Could not clear API key from localStorage");
  }
  
  toast.info("OpenAI API key has been cleared", {
    description: "AI-powered features are now disabled."
  });
}

/**
 * Analyze code with OpenAI
 * @param code - The code to analyze
 * @param prompt - The prompt to send to OpenAI
 * @returns The analysis result
 */
export async function analyzeCodeWithAI(code: string, prompt: string): Promise<string | null> {
  if (!openaiApiKey) {
    console.warn("OpenAI API key not set");
    toast.error("OpenAI API key not set", {
      description: "Please set your API key to use AI-powered code analysis."
    });
    return null;
  }

  try {
    console.log("Analyzing code with OpenAI:", code.substring(0, 100) + "...");
    apiKeyState.lastUsed = Date.now();
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using smaller model to reduce costs
        messages: [
          {
            role: "system",
            content: "You are a helpful code analysis assistant. Analyze the code below and provide insights based on the user's prompt."
          },
          {
            role: "user", 
            content: `${prompt}\n\n\`\`\`\n${code}\n\`\`\``
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error?.message || "OpenAI API request failed";
      apiKeyState.lastError = errorMessage;
      apiKeyState.failedAttempts++;
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error analyzing code with OpenAI:", error);
    
    // Handle specific API key errors
    if (error instanceof Error) {
      if (error.message.includes("invalid_api_key") || 
          error.message.includes("Invalid authentication") ||
          error.message.includes("Incorrect API key")) {
        apiKeyState.lastError = "Invalid API key";
        toast.error("Invalid OpenAI API key", {
          description: "Please check your API key and try again."
        });
      } else if (error.message.includes("exceeded your current quota")) {
        apiKeyState.lastError = "API quota exceeded";
        toast.error("OpenAI API quota exceeded", {
          description: "Your API key has reached its usage limit."
        });
      } else if (error.message.includes("rate limit")) {
        apiKeyState.lastError = "Rate limit exceeded";
        toast.error("OpenAI API rate limit exceeded", {
          description: "Please wait a moment before trying again."
        });
      } else {
        toast.error("Error analyzing code with AI", {
          description: error.message
        });
        apiKeyState.lastError = error.message;
      }
    } else {
      toast.error("Unknown error analyzing code with AI");
      apiKeyState.lastError = "Unknown error";
    }
    
    return null;
  }
}

/**
 * Generate an answer to a question based on code context
 * @param question - The question to answer
 * @param codeContext - The code context to use for answering
 * @returns The generated answer
 */
export async function generateAnswerWithAI(question: string, codeContext: string[]): Promise<string | null> {
  if (!openaiApiKey) {
    console.warn("OpenAI API key not set, cannot generate answer with AI");
    toast.error("OpenAI API key not set", {
      description: "Please set your API key to use AI-powered answers."
    });
    return null;
  }

  try {
    console.log("Generating answer for question:", question);
    console.log("Using code context of", codeContext.length, "items");
    apiKeyState.lastUsed = Date.now();
    
    // Format the context to be more readable
    const formattedContext = codeContext.map((item, index) => 
      `Context Item ${index + 1}:\n${item}`
    ).join('\n\n');
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using smaller model to reduce costs
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that answers specific questions about code repositories. Your goal is to provide precise, accurate answers that directly address the user's question.

CRITICAL GUIDELINES:
1. Answer ONLY what is specifically asked. If they ask about "download links", only mention actual download functionality.
2. Be extremely precise - don't include tangentially related information.
3. If the question asks for specific items (like "download links"), only list those exact items that match the criteria.
4. Start with a direct answer to the question, then provide supporting details.
5. If you don't find exactly what they're asking for, say so clearly rather than providing similar but different information.
6. Use clear, specific language - avoid generic terms when precise ones exist.
7. When listing items, only include items that directly match what was requested.
8. If the question is about a specific feature or functionality, focus only on that feature.
9. Distinguish between different types of links/functionality - don't group unrelated items together.
10. Provide code examples only when they directly answer the question.

Example: If asked "What download links are available?", only mention actual file download functionality, not general navigation links or API endpoints unless they specifically handle downloads.
`
          },
          {
            role: "user", 
            content: `Question: ${question}\n\nCode context from repository:\n${formattedContext}\n\nPlease answer the specific question based on the code context provided. Be precise and only include information that directly answers what was asked.`
          }
        ],
        temperature: 0.1, // Lower temperature for more focused responses
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error?.message || "OpenAI API request failed";
      apiKeyState.lastError = errorMessage;
      apiKeyState.failedAttempts++;
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating answer with OpenAI:", error);
    
    // Handle specific API key errors (same as in analyzeCodeWithAI)
    if (error instanceof Error) {
      if (error.message.includes("invalid_api_key") || 
          error.message.includes("Invalid authentication") ||
          error.message.includes("Incorrect API key")) {
        apiKeyState.lastError = "Invalid API key";
        toast.error("Invalid OpenAI API key", {
          description: "Please check your API key and try again."
        });
      } else if (error.message.includes("exceeded your current quota")) {
        apiKeyState.lastError = "API quota exceeded";
        toast.error("OpenAI API quota exceeded", {
          description: "Your API key has reached its usage limit."
        });
      } else if (error.message.includes("rate limit")) {
        apiKeyState.lastError = "Rate limit exceeded";
        toast.error("OpenAI API rate limit exceeded", {
          description: "Please wait a moment before trying again."
        });
      } else {
        toast.error("Error generating answer with AI", {
          description: error.message
        });
        apiKeyState.lastError = error.message;
      }
    } else {
      toast.error("Unknown error generating answer with AI");
      apiKeyState.lastError = "Unknown error";
    }
    
    return null;
  }
}
