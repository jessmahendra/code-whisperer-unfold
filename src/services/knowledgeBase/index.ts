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
 * Enhanced query classification for better multi-file search
 */
function classifyQuery(query: string): {
  isReadmeQuery: boolean;
  isCodeQuery: boolean;
  isArchitectureQuery: boolean;
  isConfigQuery: boolean;
  queryType: 'overview' | 'technical' | 'implementation' | 'configuration';
  normalizedQuery: string;
} {
  const lowerQuery = query.toLowerCase().trim();
  
  // README/overview patterns
  const readmePatterns = [
    'readme', 'read me', 'summary', 'summarize', 'summarise', 'overview', 
    'what is this', 'what does this do', 'about this project', 'project description',
    'getting started', 'introduction', 'intro'
  ];
  
  // Code/implementation patterns
  const codePatterns = [
    'how to', 'how do', 'how can', 'implement', 'function', 'method', 'component',
    'api', 'endpoint', 'service', 'class', 'interface', 'type', 'export',
    'import', 'module', 'library', 'package', 'dependency'
  ];
  
  // Architecture patterns
  const architecturePatterns = [
    'architecture', 'structure', 'organization', 'folder', 'directory',
    'design pattern', 'framework', 'tech stack', 'technology'
  ];
  
  // Configuration patterns
  const configPatterns = [
    'config', 'configuration', 'setup', 'install', 'deployment', 'build',
    'environment', 'env', 'settings', 'package.json', 'tsconfig'
  ];
  
  const isReadmeQuery = readmePatterns.some(pattern => lowerQuery.includes(pattern));
  const isCodeQuery = codePatterns.some(pattern => lowerQuery.includes(pattern));
  const isArchitectureQuery = architecturePatterns.some(pattern => lowerQuery.includes(pattern));
  const isConfigQuery = configPatterns.some(pattern => lowerQuery.includes(pattern));
  
  // Determine primary query type
  let queryType: 'overview' | 'technical' | 'implementation' | 'configuration' = 'overview';
  if (isCodeQuery || lowerQuery.includes('code')) queryType = 'technical';
  if (isArchitectureQuery) queryType = 'implementation';
  if (isConfigQuery) queryType = 'configuration';
  
  // Normalize variations
  let normalizedQuery = lowerQuery
    .replace(/\bsummarise\b/g, 'summarize')
    .replace(/\bread me\b/g, 'readme')
    .replace(/\babout this project\b/g, 'readme overview')
    .replace(/\bwhat is this\b/g, 'readme overview')
    .replace(/\bwhat does this do\b/g, 'readme overview');
  
  return { 
    isReadmeQuery, 
    isCodeQuery, 
    isArchitectureQuery, 
    isConfigQuery, 
    queryType, 
    normalizedQuery 
  };
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
 * Enhanced search function with balanced multi-file results
 * @param {string} query - Search query
 * @returns {KnowledgeEntry[]} Array of relevant knowledge entries
 */
export async function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  const queryClassification = classifyQuery(query);
  const { isReadmeQuery, isCodeQuery, isArchitectureQuery, isConfigQuery, queryType, normalizedQuery } = queryClassification;
  
  console.log(`🔍 Enhanced search: "${query}"`);
  console.log(`🔍 Query classification:`, queryClassification);
  console.log(`🔍 Knowledge base size: ${knowledgeBase.length} entries`);
  console.log(`🔍 Using mock data: ${initializationState.usingMockData}`);
  
  // Log file type distribution in knowledge base
  const fileTypeStats = knowledgeBase.reduce((acc, entry) => {
    const fileType = entry.metadata?.fileType || 'unknown';
    acc[fileType] = (acc[fileType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`📊 Knowledge base file types:`, fileTypeStats);
  
  // For README-specific queries, try direct lookup first
  if (isReadmeQuery && queryType === 'overview') {
    console.log('🎯 Pure README query detected, attempting direct lookup...');
    
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
  
  // Enhanced scoring algorithm with balanced file type prioritization
  const scoredEntries = knowledgeBase.map(entry => {
    let score = 0;
    const lowerQuery = normalizedQuery.toLowerCase();
    const fileName = entry.filePath.split('/').pop()?.toLowerCase() || '';
    const lowerContent = entry.content.toLowerCase();
    const lowerFilePath = entry.filePath.toLowerCase();
    const fileExtension = fileName.split('.').pop() || '';
    
    // FILE TYPE SPECIFIC SCORING based on query type
    if (queryType === 'overview' && (entry.metadata?.isReadme || fileName.includes('readme'))) {
      score += 15.0; // Moderate boost for README in overview queries
    } else if (queryType === 'technical' && ['js', 'ts', 'tsx', 'jsx'].includes(fileExtension)) {
      score += 12.0; // Strong boost for code files in technical queries
    } else if (queryType === 'implementation' && (entry.type === 'function' || entry.type === 'export')) {
      score += 10.0; // Boost for functions/exports in implementation queries
    } else if (queryType === 'configuration' && ['json', 'yml', 'yaml', 'config'].includes(fileExtension)) {
      score += 12.0; // Strong boost for config files
    }
    
    // CONTENT TYPE SCORING
    if (entry.type === 'function' && (isCodeQuery || queryType === 'technical')) {
      score += 8.0; // Functions are valuable for code queries
    } else if (entry.type === 'content' && (isReadmeQuery || queryType === 'overview')) {
      score += 6.0; // Content is valuable for overview queries
    } else if (entry.type === 'export' && (isArchitectureQuery || queryType === 'implementation')) {
      score += 7.0; // Exports are valuable for architecture queries
    }
    
    // EXACT MATCHES (highest priority)
    if (fileName.includes(lowerQuery.replace(/\s+/g, ''))) {
      score += 20.0;
      console.log(`📁 Filename match: ${entry.filePath} (+20.0)`);
    }
    
    // PATH MATCHES
    if (lowerFilePath.includes(lowerQuery)) {
      score += 15.0;
      console.log(`📂 File path match: ${entry.filePath} (+15.0)`);
    }
    
    // KEYWORD MATCHING with balanced weights
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      
      // Exact keyword matches in indexed keywords
      if (entry.keywords.some(k => k.toLowerCase() === lowerKeyword)) {
        score += 5.0;
        console.log(`🎯 Exact keyword match: ${keyword} in ${entry.filePath} (+5.0)`);
      }
      
      // Partial keyword matches
      if (entry.keywords.some(k => k.toLowerCase().includes(lowerKeyword))) {
        score += 2.0;
      }
      
      // Content matches with context awareness
      if (lowerContent.includes(lowerKeyword)) {
        score += 3.0;
        
        // Word boundary bonus
        const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryRegex.test(lowerContent)) {
          score += 2.0;
        }
        
        // Balanced documentation bonus (not overwhelming)
        if (entry.metadata?.isReadme || entry.metadata?.isDocumentation) {
          score += isReadmeQuery ? 3.0 : 1.0; // Less aggressive boost
        }
      }
      
      // File path matches
      if (lowerFilePath.includes(lowerKeyword)) {
        score += 1.5;
      }
    });
    
    // METADATA PRIORITY (balanced)
    if (entry.metadata?.priority === 'high') {
      score *= 1.5; // Reduced from 2.0 to be less aggressive
    } else if (entry.metadata?.priority === 'medium') {
      score *= 1.3;
    }
    
    // Content type boost (balanced)
    if (entry.type === 'content') {
      score *= 1.2; // Reduced from 1.3
    }
    
    const normalizedScore = score / Math.max(keywords.length, 1);
    
    return {
      entry,
      score: normalizedScore,
      debugInfo: {
        filePath: entry.filePath,
        fileType: entry.metadata?.fileType || 'unknown',
        entryType: entry.type,
        isReadme: entry.metadata?.isReadme,
        rawScore: score,
        normalizedScore: normalizedScore,
        fileName: fileName,
        queryType: queryType
      }
    };
  });
  
  // Adaptive threshold based on query type
  const threshold = isReadmeQuery && queryType === 'overview' ? 0.1 : 0.001;
  
  // Enhanced filtering and sorting with diversity
  let results = scoredEntries
    .filter(item => item.score > threshold)
    .sort((a, b) => b.score - a.score);
  
  // Ensure diversity in results for non-README queries
  if (!isReadmeQuery || queryType !== 'overview') {
    const diverseResults: typeof results = [];
    const seenFileTypes = new Set<string>();
    const maxPerType = Math.max(2, Math.floor(25 / 4)); // Max 6 per file type
    
    // First pass: ensure representation from different file types
    for (const result of results) {
      const fileType = result.debugInfo.fileType;
      const typeCount = Array.from(seenFileTypes).filter(t => t === fileType).length;
      
      if (typeCount < maxPerType) {
        diverseResults.push(result);
        seenFileTypes.add(fileType);
      }
      
      if (diverseResults.length >= 25) break;
    }
    
    // Fill remaining slots with best scores
    for (const result of results) {
      if (!diverseResults.includes(result) && diverseResults.length < 25) {
        diverseResults.push(result);
      }
    }
    
    results = diverseResults;
  }
  
  const finalResults = results
    .slice(0, 25)
    .map(item => item.entry);
  
  console.log(`🔍 Enhanced search found ${finalResults.length} results (threshold: ${threshold})`);
  
  // Enhanced debug logging with file type breakdown
  if (finalResults.length > 0) {
    console.log('🔍 Top search results by file type:');
    const resultsByType = finalResults.reduce((acc, entry) => {
      const fileType = entry.metadata?.fileType || 'unknown';
      if (!acc[fileType]) acc[fileType] = [];
      acc[fileType].push(entry);
      return acc;
    }, {} as Record<string, KnowledgeEntry[]>);
    
    Object.entries(resultsByType).forEach(([type, entries]) => {
      console.log(`  ${type}: ${entries.length} entries`);
      entries.slice(0, 2).forEach((entry, i) => {
        console.log(`    ${i + 1}. ${entry.filePath} (${entry.type})`);
      });
    });
  } else {
    console.log('❌ No search results found');
    console.log('🔍 Debug: Available entries sample:');
    knowledgeBase.slice(0, 3).forEach(entry => {
      console.log(`  - ${entry.filePath} (type: ${entry.type}, fileType: ${entry.metadata?.fileType || 'unknown'})`);
    });
  }
  
  return finalResults;
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
