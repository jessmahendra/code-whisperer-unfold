
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
    answerText = "Ghost handles subscription payments through Stripe. When a customer's subscription ends, they automatically switch to a free membership. This means they can still log in and access free content, but premium content will require renewal of their subscription.";
  } else if (query.toLowerCase().includes('post') || topics.has('post')) {
    answerText = "There's no limit to how many posts you can create in Ghost, regardless of which plan you're on. You can make some content available only to paying members by adjusting visibility settings. Ghost also lets you schedule posts to publish automatically at a future date and time, and helps optimize your content to appear higher in search engine results.";
  } else if (query.toLowerCase().includes('member') || topics.has('member')) {
    answerText = "Ghost's membership feature lets your audience sign up, subscribe to emails, and access paid content. Members can join at different levels: free members get access to basic content, paid members get premium access, and you can also manually grant premium access to specific individuals. All member information is stored securely and can be exported if needed, in compliance with privacy regulations.";
  } else if (query.toLowerCase().includes('auth') || topics.has('auth') || topics.has('authenticate')) {
    answerText = "Ghost uses a secure login system for different types of users. Site administrators log in with a username and password. Readers who sign up as members can log in with either an email/password combination or through 'magic links' sent to their email (no password needed). For connecting with other services, Ghost uses secure access keys - public keys for accessing published content and private admin keys for management functions.";
  } else if (query.toLowerCase().includes('payment') || topics.has('payment')) {
    answerText = "Ghost works directly with Stripe to handle all payments securely. Your customers can make one-time payments or sign up for regular subscriptions. If a payment doesn't go through, Ghost automatically tries again based on Stripe's retry schedule and sends notifications to both the customer and the site admin so everyone stays informed.";
  } else {
    // Generic answer for other queries
    answerText = "Based on our review of Ghost's system, this feature is handled through specific services that work together to deliver a seamless experience for both you and your audience. ";
    
    // Add some details based on what was found, in non-technical language
    if (functions.size > 0) {
      answerText += `The system includes components that handle ${Array.from(functions).slice(0, 3).join(', ')} in user-friendly ways. `;
    }
    
    answerText += "For more specific information about how this works for your particular needs, please feel free to ask a more detailed question.";
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
      answerText += `\n\nThis information is current as of ${new Date(mostRecentResult.lastUpdated).toLocaleDateString()}.`;
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
