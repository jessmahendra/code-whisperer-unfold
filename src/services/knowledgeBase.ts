import { getFileContent, getRepositoryContents, getCurrentRepository } from './githubConnector';
import { extractKnowledge } from './codeParser';
import { toast } from "sonner";

// Interface for knowledge entries
export interface KnowledgeEntry {
  type: 'comment' | 'function' | 'export';
  content: string;
  filePath: string;
  metadata?: Record<string, any>;
  keywords: string[];
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

// Cache for processed files to avoid redundant processing
const processedFilesCache: Set<string> = new Set();

// Tracks successful path patterns for future reference
let successfulPathPatterns: string[] = [];

/**
 * Initializes the knowledge base by extracting information from repository files
 * @param {boolean} forceRefresh - Whether to force refresh the knowledge base
 * @returns {Promise<void>}
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  console.log('Initializing knowledge base...');
  
  // Clear cache if forced refresh
  if (forceRefresh) {
    processedFilesCache.clear();
    successfulPathPatterns = [];
  }
  
  try {
    // Get current repository configuration
    const currentRepo = getCurrentRepository();
    
    if (!currentRepo) {
      console.log('No repository configuration found, using mock data');
      return;
    }
    
    // Common Ghost repo path patterns to try
    const pathsToTry = [
      // Most likely paths based on common Ghost structures
      '', // Root directory
      'core',
      'packages',
      'src',
      'app',
      
      // Server directories
      'core/server',
      'packages/core/server',
      'packages/ghost-core/server',
      'src/server',
      'app/server',
      
      // API directories
      'core/server/api',
      'packages/core/server/api',
      'core/server/services',
      'packages/core/server/services',
      
      // API version paths
      'core/server/api/v2',
      'core/server/api/v3',
      'core/server/api/canary',
      
      // Member-specific paths
      'core/server/services/members',
      'packages/members',
      'packages/members-api',
      
      // Content paths
      'core/server/api/v2/content',
      'core/server/api/v3/content',
      'core/server/api/canary/content',
      
      // With repo name prefix
      `${currentRepo.repo}/core/server`,
      `${currentRepo.repo}/core/server/services/members`,
      `${currentRepo.repo}/core/server/api`,
    ];
    
    // If we had successful patterns before, prioritize those
    const allPathsToTry = [...successfulPathPatterns, ...pathsToTry];
    
    console.log(`Attempting to scan ${allPathsToTry.length} possible paths in Ghost repository structure`);
    
    let processedAny = false;
    let successfulPaths = 0;
    
    for (const path of allPathsToTry) {
      try {
        console.log(`Trying path: ${path}`);
        const contents = await getRepositoryContents(path);
        
        if (contents.length > 0) {
          console.log(`Found ${contents.length} items in path: ${path}`);
          
          // Process discovered files and directories
          for (const item of contents) {
            if (item.type === 'file' && (item.name.endsWith('.js') || item.name.endsWith('.ts'))) {
              await processFile(item.path);
              processedAny = true;
              successfulPaths++;
            } else if (item.type === 'dir') {
              // Save successful paths for future reference
              if (!successfulPathPatterns.includes(path)) {
                successfulPathPatterns.push(path);
              }
              
              // Process important-looking directories
              if (
                item.name.includes('api') || 
                item.name.includes('service') || 
                item.name.includes('controller') ||
                item.name.includes('model') ||
                item.name.includes('member') ||
                item.name.includes('content') ||
                item.name.includes('subscription')
              ) {
                try {
                  await processModule(item.path);
                  processedAny = true;
                  successfulPaths++;
                } catch (dirError) {
                  console.log(`Could not process directory ${item.path}: ${dirError.message}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`Could not access path ${path}: ${error.message}`);
        // Continue trying other paths
      }
    }
    
    if (!processedAny) {
      console.log('Could not process any paths, falling back to mock data');
      toast.warning('Using mock data - repository structure may not match expected paths.', {
        description: 'Please verify the repository structure and update the configuration.',
        duration: 6000
      });
    } else {
      const successMsg = `Knowledge base initialized with ${knowledgeBase.length} entries from ${successfulPaths} paths.`;
      toast.success(successMsg, {
        description: 'Using real repository data.',
        duration: 4000
      });
      console.log(successMsg);
    }
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
    toast.error('Error initializing knowledge base', {
      description: error.message,
      duration: 5000
    });
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
        // Process JavaScript/TypeScript files
        if (item.name.endsWith('.js') || item.name.endsWith('.ts')) {
          await processFile(item.path);
        }
      } else if (item.type === 'dir') {
        // Recursively process directories, but limit depth to avoid excessive API calls
        const depth = modulePath.split('/').length;
        if (depth < 8) {  // Limit directory recursion depth
          await processModule(item.path);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing module ${modulePath}:`, error);
    throw error; // Propagate error to allow for proper path exploration
  }
}

/**
 * Processes a file by extracting knowledge from its content
 * @param {string} filePath - Path to the file
 */
async function processFile(filePath: string): Promise<void> {
  // Skip if already processed and cached
  if (processedFilesCache.has(filePath)) {
    return;
  }
  
  try {
    // Add to processed cache
    processedFilesCache.add(filePath);
    
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
      });
    }
    
    // Add function definitions to knowledge base
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
    
    // Add exports to knowledge base
    for (const [key, value] of Object.entries(knowledge.exports)) {
      knowledgeBase.push({
        type: 'export',
        content: `module.exports.${key} = ${value}`,
        filePath,
        keywords: extractKeywords(key + ' ' + value),
      });
    }
    
    // Log successful file processing
    console.log(`Successfully processed file: ${filePath}`);
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

/**
 * Clear the knowledge base
 * @returns {void}
 */
export function clearKnowledgeBase(): void {
  knowledgeBase = [];
  processedFilesCache.clear();
}

/**
 * Get statistics about the knowledge base
 * @returns {Object} Knowledge base statistics
 */
export function getKnowledgeBaseStats() {
  return {
    totalEntries: knowledgeBase.length,
    byType: {
      comment: knowledgeBase.filter(entry => entry.type === 'comment').length,
      function: knowledgeBase.filter(entry => entry.type === 'function').length,
      export: knowledgeBase.filter(entry => entry.type === 'export').length
    },
    processedFiles: processedFilesCache.size
  };
}
