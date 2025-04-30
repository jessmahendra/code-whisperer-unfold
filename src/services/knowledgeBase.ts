
import { getFileContent, getRepositoryContents } from './githubConnector';
import { extractKnowledge } from './codeParser';
import { CodeStructure } from './astParser';

// Interface for knowledge entries
interface KnowledgeEntry {
  type: 'comment' | 'function' | 'export' | 'class' | 'apiEndpoint';
  content: string;
  filePath: string;
  metadata?: Record<string, any>;
  keywords: string[];
  codeStructure?: Partial<CodeStructure>;
}

// Knowledge base with some predefined entries for demo purposes
let knowledgeBase: KnowledgeEntry[] = [
  {
    type: 'comment',
    content: '/** Processes subscription payments through Stripe integration */',
    filePath: 'ghost/core/core/server/services/members/payment.js',
    keywords: ['subscription', 'payment', 'process', 'stripe', 'members'],
  },
  {
    type: 'comment',
    content: '/** When subscription expires, member status is changed to free */',
    filePath: 'ghost/core/core/server/services/members/subscriptions.js',
    keywords: ['subscription', 'expires', 'expiration', 'member', 'free'],
  },
  {
    type: 'function',
    content: 'function handleSubscriptionExpiration(memberId) { ... }',
    filePath: 'ghost/core/core/server/services/members/api/index.js',
    metadata: {
      name: 'handleSubscriptionExpiration',
      params: 'memberId',
    },
    keywords: ['subscription', 'expiration', 'handle', 'member'],
  },
  {
    type: 'comment',
    content: '/** No limits on post count in Ghost - verified in post access controller */',
    filePath: 'ghost/core/core/server/api/v2/content/posts.js',
    keywords: ['limits', 'posts', 'count', 'restriction'],
  },
  {
    type: 'comment',
    content: '/** Premium content restricted to paid members via visibility settings */',
    filePath: 'ghost/core/core/server/api/v2/content/posts.js',
    keywords: ['premium', 'content', 'paid', 'members', 'visibility'],
  }
];

/**
 * Initializes the knowledge base by extracting information from repository files
 */
export async function initializeKnowledgeBase(): Promise<void> {
  console.log('Initializing knowledge base...');
  
  try {
    // In a real implementation, we would fetch data from GitHub
    // For demo purposes, we'll use our predefined entries
    
    // Attempt to fetch some additional data for demo purposes
    const modules = [
      'ghost/core/core/server/services/members',
      'ghost/core/core/server/api/v2/content',
    ];
    
    for (const modulePath of modules) {
      try {
        // Attempt to process module but don't block if it fails
        await processModule(modulePath);
      } catch (error) {
        // Log but continue - we have our fallback data
        console.log(`Note: Could not process module ${modulePath}: ${error.message}`);
      }
    }
    
    console.log(`Knowledge base initialized with ${knowledgeBase.length} entries`);
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
    // We already have fallback data so we won't throw
  }
}

/**
 * Processes a module by extracting knowledge from its files
 * @param {string} modulePath - Path to the module
 */
async function processModule(modulePath: string): Promise<void> {
  try {
    // Get all files in the module
    const contents = await getRepositoryContents(modulePath);
    
    // Process each item (file or directory)
    for (const item of contents) {
      if (item.type === 'file') {
        // Process JavaScript files
        if (item.name.endsWith('.js') || item.name.endsWith('.jsx') || item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
          await processFile(item.path);
        }
      } else if (item.type === 'dir') {
        // Recursively process directories
        await processModule(item.path);
      }
    }
  } catch (error) {
    console.error(`Error processing module ${modulePath}:`, error);
  }
}

/**
 * Processes a file by extracting knowledge from its content
 * @param {string} filePath - Path to the file
 */
async function processFile(filePath: string): Promise<void> {
  try {
    // Get file content
    const content = await getFileContent(filePath);
    
    // Extract knowledge
    const knowledge = extractKnowledge(content, filePath);
    
    // Add JSDoc comments to knowledge base
    for (const comment of knowledge.jsDocComments) {
      knowledgeBase.push({
        type: 'comment',
        content: comment,
        filePath,
        keywords: extractKeywords(comment),
        codeStructure: knowledge.structure ? { 
          imports: knowledge.structure.imports,
          exports: knowledge.structure.exports 
        } : undefined
      });
    }
    
    // Add function definitions to knowledge base (from regex extraction)
    for (const func of knowledge.functions) {
      const funcContent = `function ${func.name}(${func.params}) { ... }`;
      knowledgeBase.push({
        type: 'function',
        content: funcContent,
        filePath,
        metadata: func,
        keywords: extractKeywords(funcContent + ' ' + func.name),
      });
    }
    
    // Add AST-extracted classes
    if (knowledge.structure && knowledge.structure.classes) {
      for (const classInfo of knowledge.structure.classes) {
        const classContent = `class ${classInfo.name} ${classInfo.superClass ? `extends ${classInfo.superClass} ` : ''}{ ... }`;
        knowledgeBase.push({
          type: 'class',
          content: classContent,
          filePath,
          metadata: classInfo,
          keywords: extractKeywords(classContent + ' ' + classInfo.methods.join(' ')),
          codeStructure: { classes: [classInfo] }
        });
      }
    }
    
    // Add AST-extracted API endpoints
    if (knowledge.structure && knowledge.structure.apiEndpoints) {
      for (const endpoint of knowledge.structure.apiEndpoints) {
        const endpointContent = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
        knowledgeBase.push({
          type: 'apiEndpoint',
          content: endpointContent,
          filePath,
          metadata: endpoint,
          keywords: extractKeywords(`api ${endpoint.method} ${endpoint.path} ${endpoint.handler}`),
          codeStructure: { apiEndpoints: [endpoint] }
        });
      }
    }
    
    // Add exports to knowledge base
    for (const [key, value] of Object.entries(knowledge.exports)) {
      knowledgeBase.push({
        type: 'export',
        content: `module.exports.${key} = ${value}`,
        filePath,
        keywords: extractKeywords(key + ' ' + value),
      });
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

/**
 * Extracts keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {string[]} Array of keywords
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction (in a real app, this would be more sophisticated)
  const cleaned = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Split into words and filter common words
  const commonWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of']);
  const words = cleaned.split(' ').filter(word => word.length > 2 && !commonWords.has(word));
  
  return Array.from(new Set(words)); // Remove duplicates
}

/**
 * Searches the knowledge base for relevant entries
 * @param {string} query - Search query
 * @returns {KnowledgeEntry[]} Array of relevant knowledge entries
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const keywords = extractKeywords(query);
  
  if (keywords.length === 0) {
    return [];
  }
  
  // Score each entry based on keyword matches
  const scoredEntries = knowledgeBase.map(entry => {
    const matchCount = keywords.reduce((count, keyword) => {
      if (entry.keywords.includes(keyword)) {
        return count + 1;
      }
      return count;
    }, 0);
    
    return {
      entry,
      score: matchCount / keywords.length // Normalize by number of keywords
    };
  });
  
  // Sort by score and filter out low-scoring entries
  return scoredEntries
    .filter(item => item.score > 0.1) // At least some relevance
    .sort((a, b) => b.score - a.score) // Sort by descending score
    .map(item => item.entry); // Extract just the entries
}
