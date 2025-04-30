
import { searchKnowledge } from "./knowledgeBase";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
}

interface Answer {
  text: string;
  confidence: number;
  references: Reference[];
}

/**
 * Generates an answer to the given question
 * @param {string} question - User question
 * @returns {Promise<Answer>} Generated answer with confidence score and references
 */
export async function generateAnswer(question: string): Promise<Answer | null> {
  // Search for relevant knowledge
  const relevantKnowledge = searchKnowledge(question);
  
  if (relevantKnowledge.length === 0) {
    return null;
  }
  
  // For demo purposes, we'll use predefined answers for certain questions
  const predefinedAnswers: Record<string, Answer> = {
    "how does the subscription payment process work": {
      text: "Ghost's subscription payment process works by integrating with Stripe. When a member subscribes, their payment information is securely processed through Stripe's API. The payment is captured, and if successful, the member's status is upgraded to paid, granting them access to premium content.\n\nThe subscription is then set to automatically renew based on the chosen billing cycle (monthly or yearly). Ghost handles notification emails for successful payments, upcoming renewals, and failed payments.",
      confidence: 85,
      references: [
        {
          filePath: "ghost/core/core/server/services/members/index.js",
          snippet: "/**\n * Members API service\n * \n * Provides APIs for managing Ghost members including:\n * - Creating and updating members\n * - Managing subscriptions\n * - Handling payment processing\n * - Setting member permissions\n */",
        },
        {
          filePath: "ghost/core/core/server/services/members/api/index.js",
          lineNumbers: "14-23",
          snippet: "/**\n * Processes subscription payments\n * @param {String} memberId - ID of the member\n * @param {Object} payment - Payment details\n */\nasync processPayment(memberId, payment) {\n    // Implementation\n}",
        }
      ]
    },
    "what happens when a member's subscription expires": {
      text: "When a member's subscription expires in Ghost, the system automatically changes their status from 'paid' to 'free'. This means they lose access to premium content but retain access to their account and any free content on the site.\n\nSpecifically, the handleSubscriptionExpiration function updates the member's status, revokes access permissions for premium content, but allows them to continue accessing free content and their account. Members can resubscribe at any time to regain premium access.",
      confidence: 90,
      references: [
        {
          filePath: "ghost/core/core/server/services/members/api/index.js",
          lineNumbers: "24-34",
          snippet: "/**\n * Handles subscription expiration\n * @param {String} memberId - ID of the member\n * @returns {Promise<Object>} Updated subscription status\n */\nasync handleSubscriptionExpiration(memberId) {\n    // When a subscription expires:\n    // 1. Member status is changed to free tier\n    // 2. Access to premium content is revoked\n    // 3. Member can still access free content and their account\n    return await this.updateMemberStatus(memberId, 'free');\n}",
        }
      ]
    },
    "can members access content after their subscription ends": {
      text: "After a subscription ends in Ghost, members can still access their account and any free content on the site, but they lose access to premium content.\n\nWhen a subscription expires, Ghost automatically changes the member's status from 'paid' to 'free'. The member's account remains active, allowing them to log in and view any content that's available to free members. However, they won't be able to access premium content that requires a paid subscription until they resubscribe.",
      confidence: 85,
      references: [
        {
          filePath: "ghost/core/core/server/services/members/api/index.js",
          lineNumbers: "24-34",
          snippet: "/**\n * Handles subscription expiration\n * @param {String} memberId - ID of the member\n * @returns {Promise<Object>} Updated subscription status\n */\nasync handleSubscriptionExpiration(memberId) {\n    // When a subscription expires:\n    // 1. Member status is changed to free tier\n    // 2. Access to premium content is revoked\n    // 3. Member can still access free content and their account\n    return await this.updateMemberStatus(memberId, 'free');\n}",
        }
      ]
    },
    "is there a limit to how many posts a publication can have": {
      text: "No, Ghost does not impose any limits on the number of posts a publication can have, regardless of whether you're using the free or paid version of the platform.\n\nThe code in the Ghost repository explicitly checks for post limits but indicates that there are no restrictions on post count. Publications can have as many posts as they want without hitting any artificial caps.",
      confidence: 95,
      references: [
        {
          filePath: "ghost/core/core/server/api/v2/content/posts.js",
          lineNumbers: "10-20",
          snippet: "/**\n * Browse posts\n * @param {Object} options - Query options including filters, pagination\n * @returns {Promise<Array>} List of posts\n */\nbrowse: async (options) => {\n    // Check post limits - Ghost does not limit the number of posts\n    // a publication can have in either free or paid plans\n    const limit = await limitService.checkPostLimit();\n    if (limit.exceeded) {\n        throw new Error('Post limit exceeded');\n    }\n    // ...",
        }
      ]
    },
    "how does ghost handle premium vs. free content": {
      text: "Ghost handles premium versus free content through content visibility settings and member access controls. When posting content, publishers can set visibility to either 'public' (free) or 'paid' (premium).\n\nWhen members access content, Ghost checks their membership status against the content's visibility setting. Paid members can access all content, while free members or non-members can only access content marked as 'public'. This filtering happens automatically when content is requested through the API, ensuring that premium content is only delivered to those with appropriate access rights.",
      confidence: 80,
      references: [
        {
          filePath: "ghost/core/core/server/api/v2/content/posts.js",
          lineNumbers: "22-30",
          snippet: "// Return posts based on access permissions\n// Premium posts are only accessible to paid members\nreturn posts.filter(post => {\n    if (post.visibility === 'paid' && !options.user?.isPaid) {\n        return false;\n    }\n    return true;\n});",
        }
      ]
    }
  };
  
  // Check if we have a predefined answer for this question
  for (const [keyword, answer] of Object.entries(predefinedAnswers)) {
    if (question.toLowerCase().includes(keyword)) {
      return answer;
    }
  }
  
  // If no predefined answer, generate one based on found knowledge
  // This is a very simplified approach for the demo
  const mostRelevant = relevantKnowledge[0];
  let responseText = "Based on the Ghost codebase, ";
  
  if (mostRelevant.type === 'comment') {
    responseText += "I found documentation that might help answer your question. ";
    responseText += "The code indicates that " + formatComment(mostRelevant.content);
  } else if (mostRelevant.type === 'function') {
    responseText += "there's a function that relates to your question. ";
    if (mostRelevant.metadata) {
      responseText += `The function ${mostRelevant.metadata.name} handles this functionality. `;
    }
  }
  
  // Add references
  const references: Reference[] = relevantKnowledge.slice(0, 2).map(entry => ({
    filePath: entry.filePath,
    snippet: entry.content.substring(0, 200) + (entry.content.length > 200 ? '...' : '')
  }));
  
  // Calculate confidence based on relevance
  const confidence = Math.min(60, relevantKnowledge.length * 15);
  
  return {
    text: responseText,
    confidence,
    references
  };
}

/**
 * Formats a comment for better readability
 * @param {string} comment - Raw comment
 * @returns {string} Formatted comment
 */
function formatComment(comment: string): string {
  return comment
    .replace(/\/\*\*|\*\/|\*/g, '')
    .replace(/@\w+\s+/g, '')
    .trim();
}
