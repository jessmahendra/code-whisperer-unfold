
import { toast } from "sonner";
import { KnowledgeEntry, KnowledgeBaseStats } from './types';
import { mockKnowledgeEntries } from './mockData';
import { extractKeywords } from './keywordUtils';
import { getProcessedFileCount, clearProcessedFilesCache } from './fileProcessor';
import { exploreRepositoryPaths, clearSuccessfulPathPatterns } from './pathExplorer';

// Knowledge base - initialized with mock data but will be populated with real data
let knowledgeBase: KnowledgeEntry[] = [...mockKnowledgeEntries];

/**
 * Initializes the knowledge base by extracting information from repository files
 * @param {boolean} forceRefresh - Whether to force refresh the knowledge base
 * @returns {Promise<void>}
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  console.log('Initializing knowledge base...');
  
  // Clear cache if forced refresh
  if (forceRefresh) {
    clearProcessedFilesCache();
    clearSuccessfulPathPatterns();
  }
  
  try {
    // Reset knowledge base if it's a refresh
    if (forceRefresh) {
      knowledgeBase = [];
    }
    
    // Try to process repository files
    const processedAny = await exploreRepositoryPaths(knowledgeBase);
    
    if (!processedAny) {
      console.log('Could not process any paths, falling back to mock data');
      // If we couldn't process any files, use mock data
      if (knowledgeBase.length === 0) {
        knowledgeBase = [...mockKnowledgeEntries];
      }
      
      toast.warning('Using mock data - repository structure may not match expected paths.', {
        description: 'Please verify the repository structure and update the configuration.',
        duration: 6000
      });
    } else {
      const stats = getKnowledgeBaseStats();
      const successMsg = `Knowledge base initialized with ${stats.totalEntries} entries from ${stats.processedFiles} files.`;
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
  clearProcessedFilesCache();
  clearSuccessfulPathPatterns();
}

/**
 * Get statistics about the knowledge base
 * @returns {KnowledgeBaseStats} Knowledge base statistics
 */
export function getKnowledgeBaseStats(): KnowledgeBaseStats {
  return {
    totalEntries: knowledgeBase.length,
    byType: {
      comment: knowledgeBase.filter(entry => entry.type === 'comment').length,
      function: knowledgeBase.filter(entry => entry.type === 'function').length,
      export: knowledgeBase.filter(entry => entry.type === 'export').length
    },
    processedFiles: getProcessedFileCount()
  };
}

// Re-export types for external use
export { KnowledgeEntry, KnowledgeBaseStats } from './types';
