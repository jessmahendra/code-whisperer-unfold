import { KnowledgeEntry } from './types';
import { exploreRepositoryPaths, getScanDiagnostics } from './pathExplorer';
import { processFile, clearProcessedFilesCache } from './fileProcessor';
import { generateMockData } from './mockData';
import { extractKeywords } from './keywordUtils';
import { getCurrentRepository } from '../githubConnector';

// Global knowledge base
let knowledgeBase: KnowledgeEntry[] = [];
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;
let usingMockData = false;

// Enhanced initialization state tracking
let initializationState = {
  status: 'idle' as 'idle' | 'initializing' | 'complete' | 'error',
  lastInitTime: 0,
  totalEntries: 0,
  error: null as string | null,
  repository: null as { owner: string; repo: string } | null
};

/**
 * Enhanced search with Ghost-specific optimizations and multi-source ranking
 */
export async function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  console.log(`🔍 Enhanced search for: "${query}"`);
  
  if (knowledgeBase.length === 0) {
    console.log('Knowledge base is empty, initializing...');
    await initializeKnowledgeBase();
  }
  
  if (knowledgeBase.length === 0) {
    console.log('Knowledge base still empty after initialization');
    return [];
  }
  
  const queryLower = query.toLowerCase();
  const searchTerms = extractSearchTerms(query);
  console.log(`🔎 Search terms extracted:`, searchTerms);
  
  // Phase 1: Direct keyword matching with priority scoring
  const keywordMatches = knowledgeBase.map(entry => {
    let score = 0;
    const entryText = `${entry.content} ${entry.filePath}`.toLowerCase();
    const entryKeywords = entry.keywords || [];
    
    // Ghost-specific term boosting
    const ghostTerms = ['ghost', 'member', 'membership', 'subscription', 'stripe', 'payment', 'pricing', 'plan', 'tier'];
    const isGhostQuery = searchTerms.some(term => ghostTerms.includes(term));
    
    if (isGhostQuery && entry.metadata?.isGhostMembership) {
      score += 10; // High boost for Ghost membership files
    }
    
    // Priority-based scoring
    if (entry.metadata?.priority === 'high') score += 5;
    if (entry.metadata?.priority === 'medium') score += 2;
    
    // Content type scoring
    if (entry.metadata?.isReadme && (queryLower.includes('readme') || queryLower.includes('overview') || queryLower.includes('summary'))) {
      score += 8;
    }
    
    // Direct term matching
    searchTerms.forEach(term => {
      // Exact phrase matching
      if (entryText.includes(term)) {
        score += 3;
      }
      
      // Keyword matching
      if (entryKeywords.some(keyword => keyword.toLowerCase().includes(term))) {
        score += 2;
      }
      
      // File path matching
      if (entry.filePath.toLowerCase().includes(term)) {
        score += 1;
      }
    });
    
    // Boost for multiple term matches
    const matchingTerms = searchTerms.filter(term => entryText.includes(term));
    if (matchingTerms.length > 1) {
      score += matchingTerms.length;
    }
    
    return { entry, score };
  });
  
  // Phase 2: Semantic matching for better coverage
  const semanticMatches = knowledgeBase.map(entry => {
    let semanticScore = 0;
    const entryText = entry.content.toLowerCase();
    
    // Semantic term mapping for Ghost
    const semanticMap: Record<string, string[]> = {
      'membership': ['member', 'subscriber', 'user', 'account', 'profile'],
      'pricing': ['price', 'cost', 'fee', 'payment', 'billing', 'subscription'],
      'plan': ['tier', 'level', 'package', 'subscription', 'membership'],
      'free': ['trial', 'basic', 'starter', 'complimentary'],
      'premium': ['paid', 'pro', 'advanced', 'upgraded', 'subscription'],
      'feature': ['functionality', 'capability', 'option', 'benefit'],
      'download': ['install', 'setup', 'deploy', 'distribution'],
      'compare': ['difference', 'versus', 'vs', 'comparison', 'contrast']
    };
    
    searchTerms.forEach(term => {
      const semanticTerms = semanticMap[term] || [];
      semanticTerms.forEach(semanticTerm => {
        if (entryText.includes(semanticTerm)) {
          semanticScore += 1;
        }
      });
    });
    
    return { entry, semanticScore };
  });
  
  // Phase 3: Combine and rank results
  const combinedResults = keywordMatches.map((match, index) => ({
    entry: match.entry,
    totalScore: match.score + (semanticMatches[index]?.semanticScore || 0)
  }));
  
  // Filter and sort by score
  const filteredResults = combinedResults
    .filter(result => result.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore);
  
  console.log(`📊 Search results: ${filteredResults.length} matches found`);
  
  // Phase 4: Ensure diversity in results (multi-source)
  const diverseResults = ensureResultDiversity(filteredResults.map(r => r.entry));
  
  console.log(`🎯 Final diverse results: ${diverseResults.length} entries`);
  console.log(`📁 Result sources:`, diverseResults.slice(0, 5).map(r => ({
    file: r.filePath,
    type: r.metadata?.fileType || 'unknown',
    priority: r.metadata?.priority || 'none'
  })));
  
  return diverseResults;
}

/**
 * Extract search terms with enhanced processing
 */
function extractSearchTerms(query: string): string[] {
  // Clean and normalize the query
  const cleaned = query.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const terms = cleaned.split(' ').filter(term => term.length > 2);
  
  // Add common variations and synonyms
  const expandedTerms = [...terms];
  
  terms.forEach(term => {
    // Add partial matches for compound words
    if (term.length > 5) {
      expandedTerms.push(term.substring(0, term.length - 1));
    }
    
    // Add Ghost-specific expansions
    if (term === 'member') expandedTerms.push('membership', 'subscriber');
    if (term === 'price') expandedTerms.push('pricing', 'cost');
    if (term === 'plan') expandedTerms.push('tier', 'subscription');
  });
  
  return [...new Set(expandedTerms)];
}

/**
 * Ensure diversity in search results to avoid clustering from single files
 */
function ensureResultDiversity(entries: KnowledgeEntry[]): KnowledgeEntry[] {
  const diverse: KnowledgeEntry[] = [];
  const filePathCounts: Record<string, number> = {};
  const maxPerFile = 3; // Maximum entries per file
  const maxTotal = 20; // Maximum total results
  
  // First pass: Add high-priority entries
  entries.forEach(entry => {
    if (diverse.length >= maxTotal) return;
    
    const basePath = entry.filePath.split('#')[0]; // Remove chunk identifiers
    const currentCount = filePathCounts[basePath] || 0;
    
    if (entry.metadata?.priority === 'high' && currentCount < maxPerFile) {
      diverse.push(entry);
      filePathCounts[basePath] = currentCount + 1;
    }
  });
  
  // Second pass: Add medium priority entries
  entries.forEach(entry => {
    if (diverse.length >= maxTotal) return;
    if (diverse.includes(entry)) return;
    
    const basePath = entry.filePath.split('#')[0];
    const currentCount = filePathCounts[basePath] || 0;
    
    if (entry.metadata?.priority === 'medium' && currentCount < maxPerFile) {
      diverse.push(entry);
      filePathCounts[basePath] = currentCount + 1;
    }
  });
  
  // Third pass: Fill remaining slots with any relevant entries
  entries.forEach(entry => {
    if (diverse.length >= maxTotal) return;
    if (diverse.includes(entry)) return;
    
    const basePath = entry.filePath.split('#')[0];
    const currentCount = filePathCounts[basePath] || 0;
    
    if (currentCount < maxPerFile) {
      diverse.push(entry);
      filePathCounts[basePath] = currentCount + 1;
    }
  });
  
  return diverse;
}

export async function initializeKnowledgeBase(forceRefresh = false): Promise<void> {
  const repo = getCurrentRepository();
  
  if (!forceRefresh && isInitialized && knowledgeBase.length > 0) {
    console.log('Knowledge base already initialized');
    return;
  }
  
  if (initializationPromise && !forceRefresh) {
    console.log('Initialization already in progress, waiting...');
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      console.log('🚀 Initializing enhanced knowledge base...');
      initializationState = {
        status: 'initializing',
        lastInitTime: Date.now(),
        totalEntries: 0,
        error: null,
        repository: repo
      };
      
      knowledgeBase = [];
      clearProcessedFilesCache();
      isInitialized = false;
      usingMockData = false;
      
      if (!repo) {
        console.log('⚠️ No repository configured, using mock data');
        knowledgeBase = generateMockData();
        usingMockData = true;
      } else {
        console.log(`📡 Scanning repository: ${repo.owner}/${repo.repo}`);
        const success = await exploreRepositoryPaths(knowledgeBase);
        
        if (!success || knowledgeBase.length === 0) {
          console.log('⚠️ Repository scan failed or returned no results, using mock data');
          knowledgeBase = generateMockData();
          usingMockData = true;
        } else {
          console.log(`✅ Repository scan successful: ${knowledgeBase.length} entries`);
        }
      }
      
      initializationState.status = 'complete';
      initializationState.totalEntries = knowledgeBase.length;
      isInitialized = true;
      
      console.log(`🎉 Knowledge base initialization complete: ${knowledgeBase.length} entries`);
      
    } catch (error) {
      console.error('❌ Error initializing knowledge base:', error);
      initializationState.status = 'error';
      initializationState.error = error instanceof Error ? error.message : 'Unknown error';
      
      knowledgeBase = generateMockData();
      usingMockData = true;
      isInitialized = true;
    }
  })();
  
  return initializationPromise;
}

export function isUsingMockData(): boolean {
  return usingMockData;
}

export function getEnhancedDiagnostics() {
  const scanDiagnostics = getScanDiagnostics();
  
  return {
    knowledgeBaseSize: knowledgeBase.length,
    usingMockData,
    initializationState,
    lastScanDiagnostics: {
      scannedFiles: scanDiagnostics.scannedFiles,
      pathsSuccessful: scanDiagnostics.pathsSuccessful,
      repositoryFingerprint: scanDiagnostics.repositoryFingerprint,
      skippedFiles: scanDiagnostics.skippedFiles || [],
      directoryStats: scanDiagnostics.directoryStats || {}
    }
  };
}

export function clearKnowledgeBase(): void {
  knowledgeBase = [];
  isInitialized = false;
  usingMockData = false;
  clearProcessedFilesCache();
  initializationState = {
    status: 'idle',
    lastInitTime: 0,
    totalEntries: 0,
    error: null,
    repository: null
  };
}
