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
import { 
  getCachedScanData, 
  saveScanDataToCache, 
  shouldScanRepository,
  clearScanCache 
} from '../scanScheduler';
import { getActiveRepository } from '../userRepositories';

// Knowledge base - initialized with mock data but will be populated with real data
let knowledgeBase: KnowledgeEntry[] = [...mockKnowledgeEntries];

// Track initialization state
let initializationState = {
  inProgress: false,
  lastInitTime: 0,
  usingMockData: true,
  initialized: false,
  fetchConfirmed: false,
  error: null as string | null
};

/**
 * Determines if the knowledge base contains real repository data
 */
function hasRealRepositoryData(entries: KnowledgeEntry[]): boolean {
  // If we have no entries, it's definitely not real data
  if (entries.length === 0) return false;
  
  // If we only have the exact mock entries, it's mock data
  if (entries.length === mockKnowledgeEntries.length) {
    const mockPaths = new Set(mockKnowledgeEntries.map(e => e.filePath));
    const currentPaths = new Set(entries.map(e => e.filePath));
    
    // Check if all paths match the mock data
    if (mockPaths.size === currentPaths.size) {
      let allMatch = true;
      for (const path of mockPaths) {
        if (!currentPaths.has(path)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return false; // It's mock data
    }
  }
  
  // Check for repository-specific file patterns that indicate real data
  const realDataIndicators = [
    'package.json', 'README.md', 'tsconfig.json', 'vite.config',
    '.ts', '.tsx', '.js', '.jsx', 'components/', 'src/', 'app/', 'lib/'
  ];
  
  const hasRealIndicators = entries.some(entry => 
    realDataIndicators.some(indicator => 
      entry.filePath.includes(indicator)
    )
  );
  
  // If we have more than 50 entries with real indicators, it's likely real data
  return entries.length > 50 && hasRealIndicators;
}

/**
 * Load knowledge base from cache if available
 */
function loadFromCache(): boolean {
  const activeRepo = getActiveRepository();
  if (!activeRepo) return false;
  
  const cache = getCachedScanData(activeRepo.id);
  if (!cache) return false;
  
  try {
    // Load cached knowledge base
    knowledgeBase = cache.scanData.knowledgeBase || [...mockKnowledgeEntries];
    
    // Properly determine if we have real data
    const hasRealData = hasRealRepositoryData(knowledgeBase);
    
    // Update initialization state
    initializationState.usingMockData = !hasRealData;
    initializationState.initialized = true;
    initializationState.fetchConfirmed = cache.scanData.fetchConfirmed || hasRealData;
    initializationState.lastInitTime = cache.lastScanTime;
    
    console.log(`Loaded knowledge base from cache: ${knowledgeBase.length} entries, using mock data: ${initializationState.usingMockData}`);
    
    if (!initializationState.usingMockData) {
      toast.success(`Loaded cached repository data (${knowledgeBase.length} entries)`, {
        description: 'Using cached scan from ' + new Date(cache.lastScanTime).toLocaleDateString(),
        duration: 3000
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error loading from cache:', error);
    clearScanCache(activeRepo.id);
    return false;
  }
}

/**
 * Save current knowledge base to cache
 */
function saveToCache(): void {
  const activeRepo = getActiveRepository();
  if (!activeRepo) return;
  
  const scanData = {
    knowledgeBase: [...knowledgeBase],
    usingMockData: initializationState.usingMockData,
    fetchConfirmed: initializationState.fetchConfirmed,
    processedFiles: getProcessedFileCount()
  };
  
  saveScanDataToCache(activeRepo.id, scanData);
}

/**
 * Initializes the knowledge base by extracting information from repository files
 * @param {boolean} forceRefresh - Whether to force refresh the knowledge base
 * @returns {Promise<void>}
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  console.log('Initializing knowledge base...');
  
  const activeRepo = getActiveRepository();
  if (!activeRepo) {
    console.log('No active repository, using mock data');
    knowledgeBase = [...mockKnowledgeEntries];
    initializationState.usingMockData = true;
    initializationState.initialized = true;
    return;
  }
  
  // Prevent multiple simultaneous initializations
  if (initializationState.inProgress) {
    console.log('Knowledge base initialization already in progress');
    toast.info('Knowledge base initialization already in progress');
    return;
  }
  
  // Check if we should use cached data
  if (!forceRefresh && !shouldScanRepository(activeRepo.id)) {
    console.log('Using cached scan data...');
    const loaded = loadFromCache();
    if (loaded) {
      return; // Successfully loaded from cache
    }
  }
  
  // If forced refresh, clear the cache
  if (forceRefresh) {
    clearScanCache(activeRepo.id);
  }
  
  // Import here to avoid circular dependency
  const { resetConnectionState, hasConfirmedSuccessfulFetch } = await import('../githubConnector');
  
  initializationState.inProgress = true;
  initializationState.error = null;
  
  // Reset exploration progress
  resetExplorationProgress();
  
  // Reset connection tracking for fresh start
  if (forceRefresh) {
    resetConnectionState();
  }
  
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
    
    // Update state with fetch confirmation
    initializationState.fetchConfirmed = hasConfirmedSuccessfulFetch();
    initializationState.lastInitTime = Date.now();
    initializationState.initialized = true;
    
    // If we couldn't process any files or no confirmed fetch, use mock data
    if (!processedAny || !initializationState.fetchConfirmed) {
      console.log('Could not process any paths or no confirmed fetch, falling back to mock data');
      
      // If we couldn't process any files, use mock data
      if (knowledgeBase.length === 0) {
        knowledgeBase = [...mockKnowledgeEntries];
      }
      
      initializationState.usingMockData = true;
      
      const errorMsg = initializationState.fetchConfirmed ? 
        'Could not process repository files.' : 
        'Could not connect to GitHub API.';
      
      toast.warning(`Using mock data - ${errorMsg}`, {
        description: 'Please check repository configuration, token permissions, and that the repository exists.',
        duration: 6000
      });
    } else {
      initializationState.usingMockData = false;
      
      const stats = getKnowledgeBaseStats();
      const successMsg = `Knowledge base initialized with ${stats.totalEntries} entries from ${stats.processedFiles} files.`;
      toast.success(successMsg, {
        description: 'Repository scan completed and cached for 2 weeks.',
        duration: 4000
      });
      console.log(successMsg);
      
      // Save successful scan to cache
      saveToCache();
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
  
  console.log(`Searching knowledge base with keywords: ${keywords.join(', ')}`);
  console.log(`Knowledge base has ${knowledgeBase.length} entries, using mock data: ${initializationState.usingMockData}`);
  
  // Score each entry based on keyword matches
  const scoredEntries = knowledgeBase.map(entry => {
    let score = 0;
    
    // Check for exact keyword matches in content and file path
    keywords.forEach(keyword => {
      if (entry.keywords.includes(keyword)) {
        score += 1;
      }
      // Also check content and file path for partial matches
      if (entry.content.toLowerCase().includes(keyword.toLowerCase())) {
        score += 0.5;
      }
      if (entry.filePath.toLowerCase().includes(keyword.toLowerCase())) {
        score += 0.3;
      }
    });
    
    return {
      entry,
      score: score / keywords.length // Normalize by number of keywords
    };
  });
  
  // Sort by score and filter out low-scoring entries
  const results = scoredEntries
    .filter(item => item.score > 0.05) // Lower threshold for better results
    .sort((a, b) => b.score - a.score) // Sort by descending score
    .map(item => item.entry); // Extract just the entries
  
  console.log(`Found ${results.length} relevant entries for query`);
  
  return results;
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
    fetchConfirmed: false,
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
