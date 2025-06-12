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

// Knowledge base - start empty
let knowledgeBase: KnowledgeEntry[] = [];

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
 * ENHANCED: Better detection of real repository data
 */
function hasRealRepositoryData(entries: KnowledgeEntry[]): boolean {
  console.log(`🔍 Checking if data is real: ${entries.length} total entries`);
  
  if (entries.length === 0) {
    console.log('❌ No entries found - not real data');
    return false;
  }
  
  // Count real vs mock entries
  const realEntries = entries.filter(entry => 
    !entry.id.includes('mock-') && 
    !entry.content.includes('Ghost') &&
    entry.filePath !== 'mock'
  );
  
  const mockEntries = entries.length - realEntries.length;
  
  console.log(`📊 Real entries: ${realEntries.length}, Mock entries: ${mockEntries.length}`);
  
  // If we have any real entries, it's real data
  if (realEntries.length > 0) {
    console.log(`✅ Real data detected: ${realEntries.length} non-mock entries found`);
    console.log(`Sample real entries:`, realEntries.slice(0, 3).map(e => ({ 
      id: e.id, 
      file: e.filePath, 
      contentPreview: e.content.substring(0, 100) 
    })));
    return true;
  }
  
  console.log(`❌ No real entries detected among ${entries.length} total entries`);
  return false;
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
    knowledgeBase = cache.scanData.knowledgeBase || [];
    
    // Enhanced real data detection
    const hasRealData = hasRealRepositoryData(knowledgeBase);
    
    // Update initialization state
    initializationState.usingMockData = !hasRealData;
    initializationState.initialized = true;
    initializationState.fetchConfirmed = cache.scanData.fetchConfirmed || hasRealData;
    initializationState.lastInitTime = cache.lastScanTime;
    initializationState.lastRepositoryFingerprint = `${activeRepo.owner}/${activeRepo.repo}`;
    
    console.log(`📦 Cache loaded: ${knowledgeBase.length} entries, real data: ${hasRealData}`);
    
    if (!initializationState.usingMockData) {
      toast.success(`Loaded cached repository data (${knowledgeBase.length} entries)`, {
        description: 'Using cached scan from ' + new Date(cache.lastScanTime).toLocaleDateString(),
        duration: 3000
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error loading from cache:', error);
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
  console.log(`Cache saved: ${knowledgeBase.length} entries, ${diagnostics.scannedFiles} files`);
}

/**
 * Initializes the knowledge base by extracting information from repository files
 * @param {boolean} forceRefresh - Whether to force refresh the knowledge base
 * @returns {Promise<void>}
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  console.log('🚀 Initializing adaptive knowledge base...');
  
  const activeRepo = getActiveRepository();
  if (!activeRepo) {
    console.log('⚠️ No active repository, using mock data');
    knowledgeBase = [...mockKnowledgeEntries];
    initializationState.usingMockData = true;
    initializationState.initialized = true;
    return;
  }
  
  // Prevent multiple simultaneous initializations
  if (initializationState.inProgress) {
    console.log('⏳ Knowledge base initialization already in progress');
    toast.info('Knowledge base initialization already in progress');
    return;
  }
  
  // Check repository fingerprint change
  const currentFingerprint = `${activeRepo.owner}/${activeRepo.repo}`;
  const repositoryChanged = initializationState.lastRepositoryFingerprint !== currentFingerprint;
  
  if (repositoryChanged) {
    console.log('🔄 Repository changed, forcing refresh');
    forceRefresh = true;
  }
  
  // Check if we should use cached data
  if (!forceRefresh && !shouldScanRepository(activeRepo.id)) {
    console.log('📦 Using cached scan data...');
    const loaded = loadFromCache();
    if (loaded && !initializationState.usingMockData) {
      return; // Successfully loaded real data from cache
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
    // Clear knowledge base completely to start fresh
    knowledgeBase = [];
    console.log('🗑️ Starting fresh scan - knowledge base cleared completely');
    
    console.log('🔍 Starting adaptive repository exploration...');
    const processedAny = await exploreRepositoryPaths(knowledgeBase);
    
    // Get scan diagnostics
    const diagnostics = getScanDiagnostics();
    console.log(`🎯 Exploration complete. Processed any: ${processedAny}, KB size: ${knowledgeBase.length}`);
    console.log(`📁 Scanned files: ${diagnostics.scannedFiles}`);
    
    initializationState.fetchConfirmed = hasConfirmedSuccessfulFetch();
    initializationState.lastInitTime = Date.now();
    initializationState.initialized = true;
    initializationState.lastRepositoryFingerprint = currentFingerprint;
    
    // Enhanced success detection
    const hasRealData = hasRealRepositoryData(knowledgeBase);
    
    if (!hasRealData) {
      console.log('⚠️ Adaptive scan found insufficient real data, adding mock data as fallback');
      
      // Add mock data as fallback
      knowledgeBase.push(...mockKnowledgeEntries);
      
      initializationState.usingMockData = true;
      
      const errorMsg = !initializationState.fetchConfirmed ? 
        'Could not connect to GitHub API.' : 
        'Repository scan found insufficient data.';
      
      toast.warning(`Using mock data - ${errorMsg}`, {
        description: `Scanned ${diagnostics.scannedFiles} files. Check repository permissions and content.`,
        duration: 8000
      });
    } else {
      initializationState.usingMockData = false;
      
      const realEntries = knowledgeBase.filter(e => !e.id.includes('mock-')).length;
      const successMsg = `✅ Repository scan successful: ${realEntries} real entries from ${diagnostics.scannedFiles} files.`;
      toast.success(successMsg, {
        description: 'Repository data loaded successfully.',
        duration: 4000
      });
      console.log(successMsg);
      console.log('📂 Sample scanned files:', diagnostics.scannedFiles);
      console.log('📝 Sample knowledge entries:', knowledgeBase.slice(0, 3).map(e => ({ 
        id: e.id, 
        type: e.type, 
        file: e.filePath,
        content: e.content.substring(0, 100) 
      })));
      
      saveToCache();
    }
  } catch (error) {
    console.error('❌ Error in adaptive knowledge base initialization:', error);
    initializationState.error = error instanceof Error ? error.message : 'Unknown error';
    initializationState.usingMockData = true;
    
    // Add mock data as fallback
    knowledgeBase = [...mockKnowledgeEntries];
    
    toast.error('Adaptive scan failed', {
      description: initializationState.error,
      duration: 5000
    });
  } finally {
    initializationState.inProgress = false;
  }
}

/**
 * Searches the knowledge base for relevant entries with much more flexible scoring
 * @param {string} query - Search query
 * @returns {KnowledgeEntry[]} Array of relevant knowledge entries
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  console.log(`=== FLEXIBLE SEARCH DEBUG ===`);
  console.log(`Query: "${query}"`);
  console.log(`Knowledge base size: ${knowledgeBase.length}`);
  console.log(`Using mock data: ${initializationState.usingMockData}`);
  
  if (knowledgeBase.length === 0) {
    console.log('Knowledge base is empty');
    return [];
  }
  
  // Much more flexible keyword extraction - include more words
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1); // Allow 2+ character words
  
  console.log(`Search words: ${words.join(', ')}`);
  
  if (words.length === 0) {
    console.log('No search words extracted');
    return knowledgeBase.slice(0, 10); // Return some results anyway
  }
  
  // Very flexible scoring - give points for any match
  const scoredEntries = knowledgeBase.map(entry => {
    let score = 0;
    
    const lowerContent = entry.content.toLowerCase();
    const lowerFilePath = entry.filePath.toLowerCase();
    const lowerKeywords = entry.keywords.map(k => k.toLowerCase());
    
    words.forEach(word => {
      // File path matches (high value)
      if (lowerFilePath.includes(word)) {
        score += 3;
      }
      
      // Content matches (medium value)
      if (lowerContent.includes(word)) {
        score += 2;
      }
      
      // Keyword matches (high value)
      if (lowerKeywords.some(k => k.includes(word))) {
        score += 3;
      }
      
      // Type matches
      if (entry.type.toLowerCase().includes(word)) {
        score += 2;
      }
      
      // Metadata matches
      if (entry.metadata) {
        const metadataStr = JSON.stringify(entry.metadata).toLowerCase();
        if (metadataStr.includes(word)) {
          score += 1;
        }
      }
    });
    
    // Bonus for entries with more content (likely more useful)
    if (entry.content.length > 200) {
      score += 0.5;
    }
    
    return {
      entry,
      score: score
    };
  });
  
  // Very lenient filtering - accept any score > 0, or if no matches, return top entries anyway
  let results = scoredEntries
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(item => item.entry);
  
  // If no matches found, return some entries anyway (fallback)
  if (results.length === 0) {
    console.log('No scored matches found, returning fallback entries');
    results = knowledgeBase.slice(0, 5);
  }
  
  console.log(`Flexible search results: ${results.length} entries found`);
  
  if (results.length > 0) {
    const topScores = scoredEntries
      .filter(s => s.score > 0)
      .slice(0, 5)
      .map(s => s.score.toFixed(2));
    console.log(`Top 5 scores: ${topScores.join(', ')}`);
    
    console.log(`Sample results:`, results.slice(0, 3).map(r => ({ 
      file: r.filePath, 
      type: r.type, 
      score: scoredEntries.find(s => s.entry.id === r.id)?.score || 0,
      contentPreview: r.content.substring(0, 100)
    })));
  }
  
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
