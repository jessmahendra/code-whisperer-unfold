
// AI Analysis Service to enhance repository search with OpenAI
import { toast } from "sonner";

// Store the OpenAI API key in memory (not persisted for security reasons)
let openaiApiKey: string | null = null;

/**
 * Set the OpenAI API key
 * @param key - The OpenAI API key
 */
export function setOpenAIApiKey(key: string): void {
  openaiApiKey = key;
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
 * Get the OpenAI API key
 * @returns The OpenAI API key or null if not set
 */
export function getOpenAIApiKey(): string | null {
  return openaiApiKey;
}

/**
 * Clear the OpenAI API key
 */
export function clearOpenAIApiKey(): void {
  openaiApiKey = null;
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
    return null;
  }

  try {
    console.log("Analyzing code with OpenAI:", code.substring(0, 100) + "...");
    
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
      throw new Error(error.error?.message || "OpenAI API request failed");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error analyzing code with OpenAI:", error);
    toast.error("Error analyzing code with AI", {
      description: error instanceof Error ? error.message : "Unknown error occurred"
    });
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
    return null;
  }

  try {
    console.log("Generating answer for question:", question);
    console.log("Using code context of", codeContext.length, "items");
    
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
            content: "You are an AI assistant specialized in understanding the Ghost CMS codebase. Use the provided context to answer questions about the codebase accurately. If the context doesn't contain enough information to answer confidently, acknowledge the limitations."
          },
          {
            role: "user", 
            content: `Based on the following codebase context, please answer this question: ${question}\n\nContext:\n${formattedContext}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API request failed");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating answer with OpenAI:", error);
    toast.error("Error generating answer with AI", {
      description: error instanceof Error ? error.message : "Unknown error occurred"
    });
    return null;
  }
}
