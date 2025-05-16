
import { getFileContent } from './githubConnector';
import { searchKnowledge } from './knowledgeBase';
import { toast } from 'sonner';

// Default OpenAI API endpoint and configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o'; // Using OpenAI's capable model for code analysis

interface AIAnalysisResult {
  answer: string;
  confidence: number;
  relevantFiles?: string[];
}

// Store the API key securely in memory (not saved to localStorage for security)
let openaiApiKey: string | null = null;

/**
 * Set the OpenAI API key for analysis
 * @param apiKey OpenAI API key
 */
export function setOpenAIApiKey(apiKey: string): void {
  openaiApiKey = apiKey;
  // Show success toast but don't reveal the full key
  if (apiKey) {
    toast.success("OpenAI API key set successfully", {
      description: "AI-powered answers are now enabled"
    });
  } else {
    openaiApiKey = null;
    toast.error("OpenAI API key removed", {
      description: "AI-powered answers are now disabled"
    });
  }
}

/**
 * Analyzes a user question using the knowledge base and potentially OpenAI
 * @param question User's question about the repository
 * @returns Analysis result with answer and confidence score
 */
export async function analyzeQuestion(question: string): Promise<AIAnalysisResult> {
  // First search our knowledge base
  const knowledgeResults = searchKnowledge(question);
  
  if (knowledgeResults.length === 0) {
    return {
      answer: "I don't have enough information to answer this question. Try connecting to the GitHub repository or asking a different question.",
      confidence: 0.1
    };
  }
  
  // If we have results from the knowledge base and OpenAI API key, use OpenAI
  if (openaiApiKey) {
    try {
      // Format relevant content from the knowledge base
      const relevantContent = knowledgeResults
        .slice(0, 10) // Use more context with OpenAI
        .map(entry => `File: ${entry.filePath}\nType: ${entry.type}\n${entry.content}`)
        .join('\n\n');
      
      const relevantFiles = knowledgeResults
        .slice(0, 5)
        .map(entry => entry.filePath);
        
      // Create a prompt for OpenAI
      const prompt = `
You are an expert on the Ghost CMS codebase and will answer questions about it.
Be concise, accurate, and helpful.

USER QUESTION: ${question}

RELEVANT CODE AND DOCUMENTATION FROM THE CODEBASE:
${relevantContent}
      
Based on the above information only, provide a concise and accurate answer to the user's question.
If you cannot answer with confidence based on the information provided, say so and suggest what additional information might help.
Format your response in markdown for readability.`;
      
      // Call OpenAI API
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more focused answers
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API error:", errorData);
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      const aiAnswer = data.choices[0]?.message?.content || "Error processing AI response";
      
      // Confidence level based on both knowledge match and AI response
      const confidence = Math.min(0.3 + (knowledgeResults.length * 0.05), 0.95);
      
      return {
        answer: aiAnswer,
        confidence,
        relevantFiles
      };
    } catch (error) {
      console.error("Error using OpenAI:", error);
      toast.error("Error getting AI-powered answer", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
      
      // Fall back to basic answer from knowledge base
    }
  }
  
  // If no OpenAI is available or there was an error, use basic answer
  const relevantContent = knowledgeResults
    .slice(0, 5)
    .map(entry => entry.content)
    .join('\n\n');
  
  const relevantFiles = knowledgeResults
    .slice(0, 3)
    .map(entry => entry.filePath);
  
  // Create a simple answer based on the knowledge base content
  const answer = `Based on the Ghost codebase, I found relevant information in ${knowledgeResults.length} files.
  
The most relevant files are:
${relevantFiles.map(file => `- ${file}`).join('\n')}

From analyzing the content:
${relevantContent.substring(0, 500)}${relevantContent.length > 500 ? '...' : ''}

To enable AI-powered answers with deeper understanding, please add an OpenAI API key in the settings.`;
  
  return {
    answer,
    confidence: Math.min(0.1 + (knowledgeResults.length * 0.05), 0.8),
    relevantFiles
  };
}

/**
 * Checks if AI analysis capabilities are available
 * @returns Boolean indicating if AI analysis is available
 */
export function hasAICapabilities(): boolean {
  return openaiApiKey !== null;
}

/**
 * Instructions for setting up OpenAI integration
 * @returns String with setup instructions
 */
export function getAISetupInstructions(): string {
  return `To enable AI-powered code analysis and question answering:

1. Obtain an OpenAI API key from https://platform.openai.com/api-keys
2. Add the API key in the settings panel
3. Ask questions about the Ghost codebase

This will allow the application to:
- Generate comprehensive answers about code functionality
- Provide detailed explanations of Ghost features
- Help troubleshoot and understand the codebase better`;
}
