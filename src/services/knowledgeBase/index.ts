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
import { getFileContent } from '../githubConnector';

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
  // If we have no entries, it's definitely not real data
  if (entries.length === 0) return false;
  
  // Get scan diagnostics for more accurate detection
  const diagnostics = getScanDiagnostics();
  
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
  
  // If we have significantly more entries than mock data with real indicators
  const significantlyMoreData = entries.length > (mockKnowledgeEntries.length * 2);
  
  // More sophisticated detection
  if (significantlyMoreData && hasRealIndicators) {
    console.log(`Real data detected: ${entries.length} entries with real indicators`);
    return true;
  }
  
  // Check if all entries match mock data exactly
  if (entries.length === mockKnowledgeEntries.length) {
    const mockPaths = new Set(mockKnowledgeEntries.map(e => e.filePath));
    const currentPaths = new Set(entries.map(e => e.filePath));
    
    let allMatch = true;
    for (const path of mockPaths) {
      if (!currentPaths.has(path)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      console.log('Mock data detected: exact match with mock entries');
      return false;
    }
  }
  
  console.log(`Data evaluation: ${entries.length} entries, real indicators: ${hasRealIndicators}`);
  return hasRealIndicators && entries.length > 20;
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
 * Direct README fallback function - attempts to find README content directly
 */
async function findReadmeDirectly(): Promise<KnowledgeEntry | null> {
  console.log('🔍 Attempting direct README lookup fallback...');
  
  // First, check if we have any README entries in knowledge base
  const readmeEntries = knowledgeBase.filter(entry => {
    const fileName = entry.filePath.split('/').pop()?.toLowerCase() || '';
    const isReadmeFile = fileName === 'readme.md' || fileName === 'readme.txt' || fileName === 'readme' || fileName.startsWith('readme');
    const hasReadmeMetadata = entry.metadata?.isReadme || entry.metadata?.isReadmeSection;
    return isReadmeFile || hasReadmeMetadata;
  });
  
  console.log(`📖 Found ${readmeEntries.length} README entries in knowledge base`);
  
  if (readmeEntries.length > 0) {
    // Return the primary README entry (not a section)
    const primaryReadme = readmeEntries.find(entry => entry.metadata?.isReadme && !entry.metadata?.isReadmeSection) || readmeEntries[0];
    console.log(`📖 Returning primary README: ${primaryReadme.filePath}`);
    return primaryReadme;
  }
  
  // If no README in knowledge base, try to fetch directly from GitHub
  try {
    console.log('📖 Attempting direct GitHub README fetch...');
    const readmePaths = ['README.md', 'readme.md', 'README.txt', 'readme.txt', 'README'];
    
    for (const path of readmePaths) {
      try {
        const content = await getFileContent(path);
        if (content && content.length > 50) {
          console.log(`📖 Successfully fetched README from ${path}`);
          return {
            type: 'content',
            content: content.substring(0, 2000),
            filePath: path,
            keywords: extractKeywords(`readme documentation ${content.substring(0, 500)}`),
            metadata: { 
              isReadme: true, 
              priority: 'high',
              fileType: 'documentation',
              fetchedDirectly: true
            }
          };
        }
      } catch (error) {
        console.log(`📖 Could not fetch ${path}:`, error);
      }
    }
  } catch (error) {
    console.log('📖 Direct GitHub fetch failed:', error);
  }
  
  return null;
}

/**
 * Enhanced query normalization for README requests
 */
function normalizeReadmeQuery(query: string): { isReadmeQuery: boolean; normalizedQuery: string } {
  const lowerQuery = query.toLowerCase().trim();
  
  // Common README query patterns
  const readmePatterns = [
    'readme', 'read me', 'summary', 'summarize', 'summarise', 'overview', 
    'what is this', 'what does this do', 'about this project', 'project description',
    'getting started', 'documentation', 'docs', 'introduction', 'intro'
  ];
  
  const isReadmeQuery = readmePatterns.some(pattern => 
    lowerQuery.includes(pattern) || 
    lowerQuery.startsWith(pattern) ||
    lowerQuery.endsWith(pattern)
  );
  
  // Normalize variations
  let normalizedQuery = lowerQuery
    .replace(/\bsummarise\b/g, 'summarize')
    .replace(/\bread me\b/g, 'readme')
    .replace(/\babout this project\b/g, 'readme overview')
    .replace(/\bwhat is this\b/g, 'readme overview')
    .replace(/\bwhat does this do\b/g, 'readme overview');
  
  return { isReadmeQuery, normalizedQuery };
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
    
    initializationState.fetchConfirmed = hasConfirmedSuccessfulFetch();
    initializationState.lastInitTime = Date.now();
    initializationState.initialized = true;
    initializationState.lastRepositoryFingerprint = currentFingerprint;
    
    // Enhanced success detection
    const hasRealData = hasRealRepositoryData(knowledgeBase);
    
    if (!processedAny || !initializationState.fetchConfirmed || !hasRealData) {
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
      const readmeFiles = diagnostics.scannedFiles.filter(f => f.toLowerCase().includes('readme'));
      const successMsg = `Enhanced scan complete: ${stats.totalEntries} entries from ${diagnostics.scannedFiles.length} files (${readmeFiles.length} README files found).`;
      toast.success(successMsg, {
        description: 'Repository scan completed and cached for 2 weeks.',
        duration: 4000
      });
      console.log(successMsg);
      console.log('README files found:', readmeFiles);
      
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
 * Enhanced search function with better README handling and debugging
 * @param {string} query - Search query
 * @returns {KnowledgeEntry[]} Array of relevant knowledge entries
 */
export async function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  const { isReadmeQuery, normalizedQuery } = normalizeReadmeQuery(query);
  
  console.log(`🔍 Enhanced search: "${query}" (README query: ${isReadmeQuery})`);
  console.log(`🔍 Normalized query: "${normalizedQuery}"`);
  console.log(`🔍 Knowledge base size: ${knowledgeBase.length} entries`);
  console.log(`🔍 Using mock data: ${initializationState.usingMockData}`);
  
  // For README-specific queries, try direct lookup first
  if (isReadmeQuery) {
    console.log('🎯 README query detected, attempting direct lookup...');
    
    const directReadme = await findReadmeDirectly();
    if (directReadme) {
      console.log('✅ Direct README lookup successful');
      return [directReadme];
    }
    
    console.log('⚠️ Direct README lookup failed, falling back to search...');
  }
  
  const keywords = extractKeywords(normalizedQuery);
  
  if (keywords.length === 0) {
    console.log('❌ No keywords extracted from query');
    return [];
  }
  
  console.log(`🔍 Extracted keywords: ${keywords.join(', ')}`);
  
  // Enhanced scoring algorithm with much better README handling
  const scoredEntries = knowledgeBase.map(entry => {
    let score = 0;
    const lowerQuery = normalizedQuery.toLowerCase();
    const fileName = entry.filePath.split('/').pop()?.toLowerCase() || '';
    const lowerContent = entry.content.toLowerCase();
    const lowerFilePath = entry.filePath.toLowerCase();
    
    // MASSIVE BOOST: Direct README file matching for README queries
    if (isReadmeQuery) {
      if (fileName.includes('readme') || entry.metadata?.isReadme) {
        score += 50.0; // Huge boost for README queries
        console.log(`🎯 MAJOR README boost: ${entry.filePath} (+50.0)`);
      }
      
      if (entry.metadata?.isReadmeSection) {
        score += 25.0; // Good boost for README sections
        console.log(`🎯 README section boost: ${entry.filePath} (+25.0)`);
      }
    }
    
    // HIGHEST PRIORITY: Exact file name matches
    if (fileName.includes(lowerQuery.replace(/\s+/g, ''))) {
      score += 20.0;
      console.log(`📁 Filename match: ${entry.filePath} (+20.0)`);
    }
    
    // HIGH PRIORITY: File path matches
    if (lowerFilePath.includes(lowerQuery)) {
      score += 15.0;
      console.log(`📂 File path match: ${entry.filePath} (+15.0)`);
    }
    
    // ENHANCED: Documentation content matching
    if (lowerQuery.includes('doc') && (lowerFilePath.includes('doc') || fileName.includes('readme'))) {
      score += 10.0;
    }
    
    // Enhanced keyword matching with lower thresholds
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      
      // Exact keyword matches in indexed keywords (high weight)
      if (entry.keywords.some(k => k.toLowerCase() === lowerKeyword)) {
        score += 5.0;
        console.log(`🎯 Exact keyword match: ${keyword} in ${entry.filePath} (+5.0)`);
      }
      
      // Partial keyword matches
      if (entry.keywords.some(k => k.toLowerCase().includes(lowerKeyword))) {
        score += 2.0;
        console.log(`🎯 Partial keyword match: ${keyword} in ${entry.filePath} (+2.0)`);
      }
      
      // Content matches (medium weight) with context bonus
      if (lowerContent.includes(lowerKeyword)) {
        score += 3.0;
        
        // Bonus for exact word matches
        const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryRegex.test(lowerContent)) {
          score += 2.0;
          console.log(`🎯 Word boundary match: ${keyword} in ${entry.filePath} (+2.0)`);
        }
        
        // Extra bonus for matches in documentation/README content
        if (entry.metadata?.isReadme || entry.metadata?.isDocumentation || entry.metadata?.isReadmeSection) {
          score += 3.0;
          console.log(`📖 Documentation content bonus: ${keyword} in ${entry.filePath} (+3.0)`);
        }
      }
      
      // File path matches (medium weight)
      if (lowerFilePath.includes(lowerKeyword)) {
        score += 1.5;
      }
      
      // Metadata matches (if available)
      if (entry.metadata && typeof entry.metadata === 'object') {
        const metadataStr = JSON.stringify(entry.metadata).toLowerCase();
        if (metadataStr.includes(lowerKeyword)) {
          score += 1.0;
        }
      }
    });
    
    // Priority boost for high-priority content
    if (entry.metadata?.priority === 'high') {
      score *= 2.0;
      console.log(`⭐ High priority boost: ${entry.filePath} (x2.0)`);
    } else if (entry.metadata?.priority === 'medium') {
      score *= 1.5;
    }
    
    // Boost for content entries (vs. exports/functions)
    if (entry.type === 'content') {
      score *= 1.3;
    }
    
    const normalizedScore = score / Math.max(keywords.length, 1);
    
    return {
      entry,
      score: normalizedScore,
      debugInfo: {
        filePath: entry.filePath,
        isReadme: entry.metadata?.isReadme,
        isReadmeSection: entry.metadata?.isReadmeSection,
        rawScore: score,
        normalizedScore: normalizedScore,
        fileName: fileName
      }
    };
  });
  
  // Much lower threshold for better recall (especially important for README content)
  const threshold = isReadmeQuery ? 0.1 : 0.001;
  
  // Enhanced filtering and sorting
  const results = scoredEntries
    .filter(item => item.score > threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, isReadmeQuery ? 10 : 25) // Limit results but allow more for README queries
    .map(item => item.entry);
  
  console.log(`🔍 Enhanced search found ${results.length} results (threshold: ${threshold})`);
  
  // Enhanced debug logging
  if (results.length > 0) {
    console.log('🔍 Top search results:');
    scoredEntries
      .filter(s => s.score > threshold)
      .slice(0, 5)
      .forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.debugInfo.filePath}: ${s.debugInfo.normalizedScore.toFixed(3)} (README: ${s.debugInfo.isReadme}, Section: ${s.debugInfo.isReadmeSection})`);
      });
  } else {
    console.log('❌ No search results found');
    console.log('🔍 Debug: Available entries sample:');
    knowledgeBase.slice(0, 3).forEach(entry => {
      console.log(`  - ${entry.filePath} (type: ${entry.type}, keywords: ${entry.keywords.slice(0, 3).join(', ')})`);
    });
  }
  
  // If no results and it's a README query, try one more direct approach
  if (results.length === 0 && isReadmeQuery) {
    console.log('🔍 No results for README query, trying final fallback...');
    const fallbackReadme = await findReadmeDirectly();
    if (fallbackReadme) {
      console.log('✅ Final README fallback successful');
      return [fallbackReadme];
    }
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
      export: knowledgeBase.filter(entry => entry.type === 'export').length,
      content: knowledgeBase.filter(entry => entry.type === 'content').length,
      page: knowledgeBase.filter(entry => entry.type === 'page').length,
      config: knowledgeBase.filter(entry => entry.type === 'config').length,
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
