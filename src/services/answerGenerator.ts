
import { searchKnowledgeWithHistory } from "./knowledgeBaseEnhanced";
import { getLastUpdatedText } from "./knowledgeBaseEnhanced";

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
  
  // Default answers for demo
  const answers: Record<string, string> = {
    subscription: "Ghost handles subscription payments through its integration with Stripe. When a subscription expires, the member's status is automatically changed to 'free', which means they can still access free content and their account, but premium content will be restricted.",
    posts: "There are no limits on the number of posts that can be created in Ghost for any plan. However, premium content can be restricted to paid members through visibility settings.",
    default: "Based on the Ghost codebase analysis, this functionality is handled through specific services and APIs. For more detailed information, please refer to the documentation or ask a more specific question."
  };
  
  // Determine answer type from query
  let answerText = answers.default;
  if (query.toLowerCase().includes('subscription')) {
    answerText = answers.subscription;
  } else if (query.toLowerCase().includes('post')) {
    answerText = answers.posts;
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
  
  return {
    text: answerText,
    confidence: Math.min(0.3 + (results.length * 0.15), 0.95),
    references
  };
}
