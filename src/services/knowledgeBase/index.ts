
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
 * Enhanced search with better scoring and debugging
 */
export async function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  console.log(`🔍 Searching for: "${query}"`);
  console.log(`📊 Knowledge base size: ${knowledgeBase.length}`);
  
  if (knowledgeBase.length === 0) {
    console.log('Knowledge base is empty, initializing...');
    await initializeKnowledgeBase();
  }
  
  if (knowledgeBase.length === 0) {
    console.log('Knowledge base still empty after initialization');
    return [];
  }
  
  // Log all entries for debugging
  console.log('📁 All knowledge base entries:');
  knowledgeBase.forEach((entry, index) => {
    console.log(`  ${index + 1}. ${entry.filePath}: ${entry.content.substring(0, 100)}...`);
  });
  
  const queryLower = query.toLowerCase();
  const searchTerms = extractSearchTerms(query);
  console.log(`🔎 Search terms:`, searchTerms);
  
  // Enhanced scoring with better debugging
  const scoredResults = knowledgeBase.map(entry => {
    let score = 0;
    const entryText = `${entry.content} ${entry.filePath}`.toLowerCase();
    const reasons: string[] = [];
    
    // Content matching (primary scoring)
    searchTerms.forEach(term => {
      if (entryText.includes(term)) {
        score += 3;
        reasons.push(`content:${term}`);
      }
    });
    
    // Keyword matching
    if (entry.keywords) {
      entry.keywords.forEach(keyword => {
        searchTerms.forEach(term => {
          if (keyword.toLowerCase().includes(term)) {
            score += 2;
            reasons.push(`keyword:${term}`);
          }
        });
      });
    }
    
    // File path matching (reduced weight)
    searchTerms.forEach(term => {
      if (entry.filePath.toLowerCase().includes(term)) {
        score += 0.5; // Reduced from 1
        reasons.push(`path:${term}`);
      }
    });
    
    // Priority boost
    if (entry.metadata?.priority === 'high') {
      score += 1;
      reasons.push('high-priority');
    }
    
    // Penalize GitHub metadata files for general queries
    if (entry.filePath.startsWith('.github/') && !queryLower.includes('support') && !queryLower.includes('contribute')) {
      score *= 0.1;
      reasons.push('github-penalty');
    }
    
    return { entry, score, reasons };
  });
  
  // Filter and sort
  const results = scoredResults
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  console.log(`📊 Search results (top 5):`);
  results.slice(0, 5).forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.entry.filePath} (score: ${result.score.toFixed(2)}) - ${result.reasons.join(', ')}`);
  });
  
  return results.map(r => r.entry);
}

function extractSearchTerms(query: string): string[] {
  const cleaned = query.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned.split(' ').filter(term => term.length > 2);
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
      console.log('🚀 Initializing knowledge base...');
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
        
        console.log(`📊 Repository scan result: success=${success}, entries=${knowledgeBase.length}`);
        
        if (!success || knowledgeBase.length === 0) {
          console.log('⚠️ Repository scan failed, using mock data');
          knowledgeBase = generateMockData();
          usingMockData = true;
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

// Export missing functions that other components need
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

// Add missing exports for other components
export function getKnowledgeBaseStats() {
  return {
    totalEntries: knowledgeBase.length,
    usingMockData,
    lastInitialized: initializationState.lastInitTime
  };
}

export function isInitializing(): boolean {
  return initializationState.status === 'initializing';
}

export function getInitializationState() {
  return initializationState;
}
