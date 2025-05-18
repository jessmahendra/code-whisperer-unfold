
import { searchKnowledgeWithHistory } from "./knowledgeBaseEnhanced";
import { getLastUpdatedText } from "./knowledgeBaseEnhanced";
import { generateVisualContext } from "./visualContextGenerator";
import { hasAICapabilities, generateAnswerWithAI } from "./aiAnalysis";
import { toast } from "sonner";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
}

interface Answer {
  text: string;
  confidence: number;
  references: Reference[];
  visualContext?: {
    type: 'flowchart' | 'component' | 'state';
    syntax: string;
  };
}

/**
 * Generates an answer based on a user question
 * @param {string} query - User question
 * @returns {Promise<Answer|null>} Generated answer or null if no answer could be generated
 */
export async function generateAnswer(query: string): Promise<Answer | null> {
  // Simulate a slight processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Search the knowledge base with history information
  const results = await searchKnowledgeWithHistory(query);
  
  if (results.length === 0) {
    return null;
  }
  
  // Check if AI capabilities are available
  if (hasAICapabilities()) {
    try {
      // Prepare context from search results
      const context = results.map(result => {
        return `File: ${result.filePath}\n${result.content}`;
      });
      
      // Use AI to generate an answer
      const aiAnswer = await generateAnswerWithAI(query, context);
      
      if (aiAnswer) {
        // Create references with version information
        const references = results.slice(0, 3).map(result => {
          return {
            filePath: result.filePath,
            snippet: result.content.substring(0, 120) + (result.content.length > 120 ? '...' : ''),
            lastUpdated: result.lastUpdated
          };
        });
        
        // Generate visual context if applicable
        let visualContext = null;
        if (query.toLowerCase().includes('flow') || 
            query.toLowerCase().includes('process') ||
            query.toLowerCase().includes('subscription') ||
            query.toLowerCase().includes('post') ||
            query.toLowerCase().includes('content') ||
            query.toLowerCase().includes('component') ||
            query.toLowerCase().includes('state')) {
          visualContext = generateVisualContext(query, results);
        }
        
        // Return AI-generated answer with high confidence
        return {
          text: aiAnswer,
          confidence: 0.92, // AI answers have higher confidence
          references,
          visualContext: visualContext
        };
      }
    } catch (error) {
      console.error("Error generating AI answer:", error);
      toast.error("AI answer generation failed, falling back to template-based answers");
      // Fall back to template-based answers
    }
  }
  
  // Extract key topics from the results to generate a coherent answer
  const topics = new Set<string>();
  const fileTypes = new Set<string>();
  const functions = new Set<string>();
  const entityWords = ['member', 'subscription', 'post', 'page', 'author', 'tag', 'payment', 'theme'];
  const actionWords = ['create', 'read', 'update', 'delete', 'authenticate', 'authorize', 'process', 'publish', 'schedule'];
  
  // Analyze results to identify key topics, entities, and actions
  results.forEach(result => {
    // Extract file name without extension for topic identification
    const fileName = result.filePath.split('/').pop()?.split('.')[0];
    if (fileName) topics.add(fileName);
    
    // Extract file type
    const fileType = result.filePath.split('.').pop();
    if (fileType) fileTypes.add(fileType);
    
    // Extract function names
    if (result.metadata?.name) functions.add(result.metadata.name);
    
    // Extract content words
    const contentWords = result.content.toLowerCase().split(/\W+/).filter(Boolean);
    contentWords.forEach(word => {
      if (entityWords.includes(word)) topics.add(word);
      if (actionWords.includes(word)) topics.add(word);
    });
  });
  
  // Generate answer based on identified topics and results
  let answerText = '';
  
  // Generate specific answers based on identified topics
  if (query.toLowerCase().includes('subscription') || topics.has('subscription')) {
    answerText = "Ghost handles subscription payments through its integration with Stripe. When a subscription expires, the member's status is automatically changed to 'free', which means they can still access free content and their account, but premium content will be restricted.";
  } else if (query.toLowerCase().includes('post') || topics.has('post')) {
    answerText = "There are no limits on the number of posts that can be created in Ghost for any plan. However, premium content can be restricted to paid members through visibility settings. Posts can be scheduled for future publication, and Ghost handles SEO metadata for optimizing post visibility in search engines.";
  } else if (query.toLowerCase().includes('member') || topics.has('member')) {
    answerText = "Ghost's members feature enables user registration, email subscriptions, and paid memberships. Members can have different access levels: free, paid, or comped (manually granted premium access). Member data is stored securely and can be exported in compliance with data protection regulations.";
  } else if (query.toLowerCase().includes('auth') || topics.has('auth') || topics.has('authenticate')) {
    answerText = "Ghost uses a token-based authentication system. Admin users authenticate with username/password, while members can use email/password or magic links. API authentication uses content API keys for public content and admin API keys for administrative tasks.";
  } else if (query.toLowerCase().includes('payment') || topics.has('payment')) {
    answerText = "Ghost integrates directly with Stripe for payment processing. It supports one-time payments and recurring subscriptions. When payments fail, Ghost automatically retries based on Stripe's retry schedule and notifies both the member and site admin.";
  } else {
    // Generic answer for other queries
    answerText = "Based on the Ghost codebase analysis, this functionality is handled through specific services and APIs. ";
    
    // Add some details based on what was found
    if (functions.size > 0) {
      answerText += `Key functions involved include ${Array.from(functions).slice(0, 3).join(', ')}. `;
    }
    
    answerText += "For more detailed information, please refer to the documentation or ask a more specific question.";
  }
  
  // Add version awareness to the answer
  if (results.some(result => result.lastUpdated)) {
    const mostRecentResult = [...results].sort((a, b) => {
      if (!a.lastUpdated || a.lastUpdated === 'Unknown') return 1;
      if (!b.lastUpdated || b.lastUpdated === 'Unknown') return -1;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    })[0];
    
    // Add timestamp information to the answer
    if (mostRecentResult.lastUpdated && mostRecentResult.lastUpdated !== 'Unknown') {
      answerText += `\n\nThis information reflects the code as of ${new Date(mostRecentResult.lastUpdated).toLocaleDateString()}.`;
    }
  }
  
  // Create references with version information
  const references = results.slice(0, 3).map(result => {
    return {
      filePath: result.filePath,
      snippet: result.content.substring(0, 120) + (result.content.length > 120 ? '...' : ''),
      lastUpdated: result.lastUpdated
    };
  });

  // Generate visual context if applicable
  let visualContext = null;
  if (query.toLowerCase().includes('flow') || 
      query.toLowerCase().includes('process') ||
      query.toLowerCase().includes('subscription') ||
      query.toLowerCase().includes('post') ||
      query.toLowerCase().includes('content') ||
      query.toLowerCase().includes('component') ||
      query.toLowerCase().includes('state')) {
    visualContext = generateVisualContext(query, results);
  }
  
  return {
    text: answerText,
    confidence: Math.min(0.3 + (results.length * 0.15), 0.95),
    references,
    visualContext: visualContext
  };
}
