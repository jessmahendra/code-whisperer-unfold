
import { getFileContent, getRepositoryContents } from './githubConnector';
import { extractKnowledge } from './codeParser';

// Interface for knowledge entries
interface KnowledgeEntry {
  type: 'comment' | 'function' | 'export';
  content: string;
  filePath: string;
  metadata?: Record<string, any>;
  keywords: string[];
}

// Mock knowledge base
let knowledgeBase: KnowledgeEntry[] = [];

/**
 * Initializes the knowledge base by extracting information from repository files
 */
export async function initializeKnowledgeBase(): Promise<void> {
  console.log('Initializing knowledge base...');
  
  // Define the modules we want to analyze
  const modules = [
    'ghost/core/core/server/services/members',
    'ghost/core/core/server/api/v2/content',
    'ghost/core/core/server/services/auth'
  ];
  
  // Process each module
  for (const modulePath of modules) {
    await processModule(modulePath);
  }
  
  console.log(`Knowledge base initialized with ${knowledgeBase.length} entries`);
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
        if (item.name.endsWith('.js')) {
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
