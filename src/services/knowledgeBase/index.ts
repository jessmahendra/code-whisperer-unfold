import { toast } from "sonner";
import { KnowledgeEntry, KnowledgeBaseStats } from './types';
import { mockKnowledgeEntries } from './mockData';
import { extractKeywords } from './keywordUtils';
import { getProcessedFileCount, clearProcessedFilesCache } from './fileProcessor';
import { 
  exploreRepositoryPaths, 
  clearSuccessfulPathPatterns, 
  getExplorationProgress,
  resetExplorationProgress 
} from './pathExplorer';

// Knowledge base - initialized with mock data but will be populated with real data
let knowledgeBase: KnowledgeEntry[] = [...mockKnowledgeEntries];

// Track initialization state
let initializationState = {
  inProgress: false,
  lastInitTime: 0,
  usingMockData: true,
  initialized: false,
  error: null as string | null
};

/**
 * Initializes the knowledge base by extracting information from repository files
 * @param {boolean} forceRefresh - Whether to force refresh the knowledge base
 * @returns {Promise<void>}
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  console.log('Initializing knowledge base...');
  
  // Prevent multiple simultaneous initializations
  if (initializationState.inProgress) {
    console.log('Knowledge base initialization already in progress');
    toast.info('Knowledge base initialization already in progress');
    return;
  }
  
  initializationState.inProgress = true;
  initializationState.error = null;
  
  // Reset exploration progress
  resetExplorationProgress();
  
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
    initializationState.lastInitTime = Date.now();
    initializationState.initialized = true;
    
    if (!processedAny) {
      console.log('Could not process any paths, falling back to mock data');
      // If we couldn't process any files, use mock data
      if (knowledgeBase.length === 0) {
        knowledgeBase = [...mockKnowledgeEntries];
      }
      
      initializationState.usingMockData = true;
      
      toast.warning('Using mock data - could not access repository files.', {
        description: 'Please check repository configuration, token permissions, and that the repository exists.',
        duration: 6000
      });
    } else {
      initializationState.usingMockData = false;
      
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
    initializationState.error = error instanceof Error ? error.message : 'Unknown error';
    initializationState.usingMockData = true;
    
    toast.error('Error initializing knowledge base', {
      description: initializationState.error,
      duration: 5000
    });
  } finally {
    initializationState.inProgress = false;
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
  resetExplorationProgress();
  initializationState = {
    inProgress: false,
    lastInitTime: 0,
    usingMockData: true,
    initialized: false,
    error: null
  };
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

/**
 * Check if we're using mock data or real data
 * @returns {boolean} True if using mock data
 */
export function isUsingMockData(): boolean {
  return initializationState.usingMockData;
}

/**
 * Get the initialization state
 * @returns Current initialization state
 */
export function getInitializationState(): typeof initializationState {
  return { ...initializationState };
}

/**
 * Check if initialization is in progress
 * @returns {boolean} True if initialization is in progress
 */
export function isInitializing(): boolean {
  return initializationState.inProgress;
}

// Re-export types for external use - fix the isolatedModules issue by using 'export type'
export type { KnowledgeEntry, KnowledgeBaseStats } from './types';
