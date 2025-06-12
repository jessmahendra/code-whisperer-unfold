import { toast } from "sonner";
import { KnowledgeEntry, KnowledgeBaseStats } from './types';
import { mockKnowledgeEntries } from './mockData';
import { extractKeywords } from './keywordUtils';
import { getProcessedFileCount, clearProcessedFilesCache } from './fileProcessor';
import { 
  exploreRepositoryPaths, 
  clearSuccessfulPathPatterns, 
  getExplorationProgress,
  resetExplorationProgress,
  getScanDiagnostics
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
  error: null as string | null,
  lastRepositoryFingerprint: null as string | null
};

/**
 * Enhanced detection of real repository data
 */
function hasRealRepositoryData(entries: KnowledgeEntry[]): boolean {
  console.log(`Checking if data is real: ${entries.length} entries`);
  
  // If we have no entries, it's definitely not real data
  if (entries.length === 0) {
    console.log('No entries found - not real data');
    return false;
  }
  
  // Get scan diagnostics for more accurate detection
  const diagnostics = getScanDiagnostics();
  console.log(`Scan diagnostics: ${diagnostics.scannedFiles.length} files scanned`);
  
  // If we have scanned files from the path explorer, it's likely real data
  if (diagnostics.scannedFiles.length > 0) {
    console.log(`Real data detected: ${diagnostics.scannedFiles.length} files scanned`);
    return true;
  }
  
  // Check for repository-specific patterns that indicate real data
  const realDataIndicators = [
    'package.json', 'tsconfig.json', 'vite.config', 'next.config',
    'src/', 'app/', 'components/', 'pages/', 'services/', 'utils/'
  ];
  
  const hasRealIndicators = entries.some(entry => 
    realDataIndicators.some(indicator => 
      entry.filePath.includes(indicator)
    )
  );
  
  console.log(`Real indicators found: ${hasRealIndicators}`);
  
  // If we have significantly more entries than mock data with real indicators
  const significantlyMoreData = entries.length > (mockKnowledgeEntries.length * 1.5);
  
  // More sophisticated detection - lower the threshold
  if (hasRealIndicators || significantlyMoreData) {
    console.log(`Real data detected: ${entries.length} entries, indicators: ${hasRealIndicators}, more data: ${significantlyMoreData}`);
    return true;
  }
  
  console.log(`Data evaluation: ${entries.length} entries, real indicators: ${hasRealIndicators}`);
  return entries.length > 15; // Lower threshold
}

/**
 * Enhanced cache loading with fingerprint validation
 */
function loadFromCache(): boolean {
  const activeRepo = getActiveRepository();
  if (!activeRepo) return false;
  
  const cache = getCachedScanData(activeRepo.id);
  if (!cache) return false;
  
  try {
    // Load cached knowledge base
    knowledgeBase = cache.scanData.knowledgeBase || [...mockKnowledgeEntries];
    
    // Enhanced real data detection
    const hasRealData = hasRealRepositoryData(knowledgeBase);
    
    // Update initialization state
    initializationState.usingMockData = !hasRealData;
    initializationState.initialized = true;
    initializationState.fetchConfirmed = cache.scanData.fetchConfirmed || hasRealData;
    initializationState.lastInitTime = cache.lastScanTime;
    initializationState.lastRepositoryFingerprint = `${activeRepo.owner}/${activeRepo.repo}`;
    
    console.log(`Cache loaded: ${knowledgeBase.length} entries, real data: ${hasRealData}`);
    
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
 * Enhanced cache saving with diagnostics
 */
function saveToCache(): void {
  const activeRepo = getActiveRepository();
  if (!activeRepo) return;
  
  const diagnostics = getScanDiagnostics();
  
  const scanData = {
    knowledgeBase: [...knowledgeBase],
    usingMockData: initializationState.usingMockData,
    fetchConfirmed: initializationState.fetchConfirmed,
    processedFiles: getProcessedFileCount(),
    scannedFiles: diagnostics.scannedFiles,
    repositoryFingerprint: diagnostics.repositoryFingerprint
  };
  
  saveScanDataToCache(activeRepo.id, scanData);
  console.log(`Cache saved: ${knowledgeBase.length} entries, ${diagnostics.scannedFiles.length} files`);
}

/**
 * Initializes the knowledge base by extracting information from repository files
 * @param {boolean} forceRefresh - Whether to force refresh the knowledge base
 * @returns {Promise<void>}
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  console.log('Initializing enhanced knowledge base...');
  
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
  
  // Check repository fingerprint change
  const currentFingerprint = `${activeRepo.owner}/${activeRepo.repo}`;
  const repositoryChanged = initializationState.lastRepositoryFingerprint !== currentFingerprint;
  
  if (repositoryChanged) {
    console.log('Repository changed, forcing refresh');
    forceRefresh = true;
  }
  
  // Check if we should use cached data
  if (!forceRefresh && !shouldScanRepository(activeRepo.id)) {
    console.log('Using cached scan data...');
    const loaded = loadFromCache();
    if (loaded) {
      return; // Successfully loaded from cache
    }
  }
  
  // Clear cache if forced refresh or repository changed
  if (forceRefresh || repositoryChanged) {
    clearScanCache(activeRepo.id);
  }
  
  const { resetConnectionState, hasConfirmedSuccessfulFetch } = await import('../githubConnector');
  
  initializationState.inProgress = true;
  initializationState.error = null;
  
  resetExplorationProgress();
  
  if (forceRefresh) {
    resetConnectionState();
    clearProcessedFilesCache();
    clearSuccessfulPathPatterns();
  }
  
  try {
    if (forceRefresh) {
      knowledgeBase = [];
    }
    
    console.log('Starting enhanced repository exploration...');
    const processedAny = await exploreRepositoryPaths(knowledgeBase);
    
    // Get scan diagnostics
    const diagnostics = getScanDiagnostics();
    console.log(`Exploration complete. Processed any: ${processedAny}, KB size: ${knowledgeBase.length}`);
    
    initializationState.fetchConfirmed = hasConfirmedSuccessfulFetch();
    initializationState.lastInitTime = Date.now();
    initializationState.initialized = true;
    initializationState.lastRepositoryFingerprint = currentFingerprint;
    
    // Enhanced success detection with more lenient criteria
    const hasRealData = hasRealRepositoryData(knowledgeBase);
    
    if (!hasRealData && knowledgeBase.length < 5) {
      console.log('Enhanced scan failed or insufficient data, using mock data');
      
      if (knowledgeBase.length === 0) {
        knowledgeBase = [...mockKnowledgeEntries];
      }
      
      initializationState.usingMockData = true;
      
      const errorMsg = !initializationState.fetchConfirmed ? 
        'Could not connect to GitHub API.' : 
        'Repository scan found insufficient data.';
      
      toast.warning(`Using mock data - ${errorMsg}`, {
        description: `Scanned ${diagnostics.scannedFiles.length} files. Check repository permissions and content.`,
        duration: 8000
      });
    } else {
      initializationState.usingMockData = false;
      
      const stats = getKnowledgeBaseStats();
      const successMsg = `Enhanced scan complete: ${stats.totalEntries} entries from ${diagnostics.scannedFiles.length} files.`;
      toast.success(successMsg, {
        description: 'Repository scan completed and cached for 2 weeks.',
        duration: 4000
      });
      console.log(successMsg);
      console.log('Sample scanned files:', diagnostics.scannedFiles.slice(0, 5));
      
      saveToCache();
    }
  } catch (error) {
    console.error('Error in enhanced knowledge base initialization:', error);
    initializationState.error = error instanceof Error ? error.message : 'Unknown error';
    initializationState.usingMockData = true;
    
    toast.error('Enhanced scan failed', {
      description: initializationState.error,
      duration: 5000
    });
  } finally {
    initializationState.inProgress = false;
  }
}

/**
 * Searches the knowledge base for relevant entries with improved scoring
 * @param {string} query - Search query
 * @returns {KnowledgeEntry[]} Array of relevant knowledge entries
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  console.log(`=== SEARCH DEBUG ===`);
  console.log(`Query: "${query}"`);
  console.log(`Knowledge base size: ${knowledgeBase.length}`);
  console.log(`Using mock data: ${initializationState.usingMockData}`);
  
  const keywords = extractKeywords(query);
  console.log(`Extracted keywords: ${keywords.join(', ')}`);
  
  if (keywords.length === 0) {
    console.log('No keywords extracted, returning empty results');
    return [];
  }
  
  // Enhanced scoring algorithm with lower thresholds
  const scoredEntries = knowledgeBase.map(entry => {
    let score = 0;
    
    // Exact keyword matches (highest weight)
    keywords.forEach(keyword => {
      if (entry.keywords.includes(keyword)) {
        score += 3.0;
      }
      
      // Content matches (medium weight) - case insensitive
      const lowerContent = entry.content.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      
      if (lowerContent.includes(lowerKeyword)) {
        score += 2.0;
        
        // Bonus for exact word matches
        const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryRegex.test(lowerContent)) {
          score += 1.0;
        }
      }
      
      // File path matches (lower weight)
      if (entry.filePath.toLowerCase().includes(lowerKeyword)) {
        score += 1.0;
      }
      
      // Metadata matches (if available)
      if (entry.metadata && typeof entry.metadata === 'object') {
        const metadataStr = JSON.stringify(entry.metadata).toLowerCase();
        if (metadataStr.includes(lowerKeyword)) {
          score += 0.5;
        }
      }
    });
    
    return {
      entry,
      score: score
    };
  });
  
  // Much more lenient filtering and sorting
  const results = scoredEntries
    .filter(item => item.score > 0.01) // Very low threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 25) // More results
    .map(item => item.entry);
  
  console.log(`Search results: ${results.length} entries found`);
  console.log(`Top 3 scores: ${scoredEntries.filter(s => s.score > 0.01).slice(0, 3).map(s => s.score.toFixed(2)).join(', ')}`);
  console.log(`Sample results:`, results.slice(0, 3).map(r => ({ file: r.filePath, type: r.type, contentPreview: r.content.substring(0, 50) })));
  
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
    error: null,
    lastRepositoryFingerprint: null
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

/**
 * Get enhanced diagnostic information
 */
export function getEnhancedDiagnostics(): {
  knowledgeBaseSize: number;
  usingMockData: boolean;
  lastScanDiagnostics: ReturnType<typeof getScanDiagnostics>;
  initializationState: typeof initializationState;
} {
  return {
    knowledgeBaseSize: knowledgeBase.length,
    usingMockData: initializationState.usingMockData,
    lastScanDiagnostics: getScanDiagnostics(),
    initializationState: { ...initializationState }
  };
}

// Re-export types for external use
export type { KnowledgeEntry, KnowledgeBaseStats } from './types';
