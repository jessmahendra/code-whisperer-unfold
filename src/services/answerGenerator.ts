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
 * @param {Object} [options] - Options for generating the answer
 * @param {boolean} [options.concise] - Whether to generate a concise answer
 * @param {boolean} [options.skipBenefits] - Whether to skip benefits sections
 * @returns {Promise<Answer|null>} Generated answer or null if no answer could be generated
 */
export async function generateAnswer(query: string, options?: { 
  concise?: boolean, 
  skipBenefits?: boolean 
}): Promise<Answer | null> {
  // Simulate a slight processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    // Search the knowledge base with history information
    const results = await searchKnowledgeWithHistory(query);
    
    if (results.length === 0) {
      console.log("No results found for query:", query);
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
      answerText = "## Subscription Management\n\nGhost handles subscription payments through Stripe. When a customer's subscription ends, they automatically switch to a free membership. This means they can still log in and access free content, but premium content will require renewal of their subscription.\n\n**Key points:**\n\n* Payments processed securely via Stripe\n* Expired subscriptions become free members automatically\n* Free members retain access to non-premium content";
    } else if (query.toLowerCase().includes('post') || topics.has('post')) {
      answerText = "## Post Management\n\nThere's no limit to how many posts you can create in Ghost, regardless of which plan you're on. You can make some content available only to paying members by adjusting visibility settings.\n\n**Key features:**\n\n* Unlimited posts on all plans\n* Schedule posts for future publication\n* Control access with member-only visibility settings\n* SEO optimization tools built-in";
    } else if (query.toLowerCase().includes('member') || topics.has('member')) {
      answerText = "## Member Management\n\nGhost's membership feature lets your audience sign up, subscribe to emails, and access paid content. Members can join at different levels:\n\n* **Free members** - Access to basic content\n* **Paid members** - Premium access to all content\n* **Comped members** - Premium access granted manually\n\nAll member information is stored securely and can be exported if needed, in compliance with privacy regulations.";
    } else if (query.toLowerCase().includes('auth') || topics.has('auth') || topics.has('authenticate')) {
      answerText = "## Authentication Options\n\nGhost uses a secure login system for different types of users:\n\n* **Site administrators** - Username and password login\n* **Members** - Email/password or magic link authentication (no password needed)\n* **Service connections** - Secure access keys:\n  * Public keys for accessing published content\n  * Private admin keys for management functions";
    } else if (query.toLowerCase().includes('payment') || topics.has('payment')) {
      answerText = "## Payment Processing\n\nGhost works directly with Stripe to handle all payments securely. Your customers can make one-time payments or sign up for regular subscriptions.\n\n**If a payment doesn't go through:**\n\n* Stripe automatically retries based on their retry schedule\n* Notifications are sent to both the customer and site admin\n* Failed payment status is visible in the admin dashboard";
    } else if (query.toLowerCase().includes('integration') || query.toLowerCase().includes('platform') || topics.has('integration')) {
      answerText = "## Ghost Integration Options\n\nGhost connects seamlessly with many popular platforms and services:\n\n* **Email providers** - Mailgun, Amazon SES, SendGrid\n* **Payment processors** - Stripe (built-in)\n* **Social media** - Facebook, Twitter, LinkedIn (automatic sharing)\n* **Analytics** - Google Analytics, Plausible, Matomo\n* **Membership tools** - Discord, Slack (community access)\n* **Content tools** - Unsplash (built-in), Zapier (automation)\n\nIntegrations can be managed through the Ghost admin interface or via the custom integrations API for advanced needs.";
    } else if (query.toLowerCase().includes('analytics') || query.toLowerCase().includes('dashboard') || query.toLowerCase().includes('stats')) {
      answerText = "## Analytics Dashboard\n\nGhost provides a built-in analytics dashboard that offers valuable insights into your audience and content performance.\n\n**Key metrics available:**\n\n* **Member growth** - Track new sign-ups, conversions from free to paid, and churn rate\n* **Content performance** - See which posts receive the most views and engagement\n* **Revenue stats** - Monitor monthly recurring revenue (MRR) and other financial metrics\n* **Email engagement** - View open rates, click-through rates, and subscription statistics\n* **Retention data** - Analyze how long members stay subscribed and identify patterns\n\nAll analytics are available directly in your Ghost admin dashboard without requiring external tools, though you can integrate with services like Google Analytics for more advanced analysis.";
    } else {
      // Generic answer for other queries with markdown formatting
      answerText = "## Ghost Platform Features\n\nBased on our review of Ghost's system, this feature is handled through specific services that work together to deliver a seamless experience for both you and your audience.\n\n";
      
      // Add some details based on what was found, in non-technical language
      if (functions.size > 0) {
        answerText += "The system includes components that handle " + Array.from(functions).slice(0, 3).join(', ') + " in user-friendly ways.\n\n";
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
        answerText += `\n\n**This information is current as of ${new Date(mostRecentResult.lastUpdated).toLocaleDateString()}.**`;
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
    
    console.log("Generated template answer:", answerText.substring(0, 100) + "...");
    
    return {
      text: answerText,
      confidence: Math.min(0.3 + (results.length * 0.15), 0.95),
      references,
      visualContext: visualContext
    };
  } catch (error) {
    console.error("Error in generateAnswer:", error);
    return null;
  }
}
