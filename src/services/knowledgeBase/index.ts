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
import { getConnectionDiagnostics } from '../githubConnector';

// Safe JSON serialization to handle circular references
function safeStringify(obj: unknown, maxDepth: number = 3): string {
  const seen = new WeakSet();
  
  function safeStringifyHelper(obj: unknown, depth: number = 0): unknown {
    if (depth > maxDepth) return '[Max Depth Reached]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    if (seen.has(obj as object)) return '[Circular Reference]';
    seen.add(obj as object);
    
    try {
      if (Array.isArray(obj)) {
        return obj.map(item => safeStringifyHelper(item, depth + 1));
      } else {
        const result: Record<string, unknown> = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Skip problematic properties that might cause circular references
            if (key === 'frontmatter' && typeof (obj as Record<string, unknown>)[key] === 'object') {
              result[key] = '[Frontmatter Object]';
            } else {
              result[key] = safeStringifyHelper((obj as Record<string, unknown>)[key], depth + 1);
            }
          }
        }
        return result;
      }
    } catch (error) {
      return '[Serialization Error]';
    } finally {
      seen.delete(obj as object);
    }
  }
  
  try {
    return JSON.stringify(safeStringifyHelper(obj));
  } catch (error) {
    console.error('Safe JSON stringify failed:', error);
    return '{}';
  }
}

// Search result type for the new universal search system
interface SearchResult {
  filePath: string;
  content: string;
  score: number;
  keywordMatches: string[];
  intent: 'ui' | 'api' | 'auth' | 'data' | 'business' | 'performance' | 'integration' | 'configuration' | 'general' | 'capability' | 'coverage' | 'process' | 'pricing' | 'constraint';
  businessLogic?: string[];
  relevance?: number; // For business search compatibility
  fileName?: string; // For business search compatibility
}

// Knowledge base - initialized with mock data but will be populated with real data
let knowledgeBase: KnowledgeEntry[] = [...mockKnowledgeEntries];

// Track initialization state
const initializationState = {
  inProgress: false,
  lastInitTime: 0,
  usingMockData: true,
  initialized: false,
  fetchConfirmed: false,
  error: null as string | null,
  lastRepositoryFingerprint: null as string | null
};

// Dynamic codebase analysis state
interface CodebaseAnalysis {
  projectStructure: {
    mainDirectories: string[];
    technologyStack: string[];
    fileExtensions: string[];
    commonPatterns: string[];
  };
  domainVocabulary: {
    commonTerms: string[];
    domainKeywords: string[];
    componentPatterns: string[];
  };
  scoringWeights: {
    directoryImportance: Record<string, number>;
    fileTypeRelevance: Record<string, number>;
    contentPatterns: Record<string, number>;
  };
  lastAnalysis: number;
}

let codebaseAnalysis: CodebaseAnalysis = {
  projectStructure: {
    mainDirectories: [],
    technologyStack: [],
    fileExtensions: [],
    commonPatterns: []
  },
  domainVocabulary: {
    commonTerms: [],
    domainKeywords: [],
    componentPatterns: []
  },
  scoringWeights: {
    directoryImportance: {},
    fileTypeRelevance: {},
    contentPatterns: {}
  },
  lastAnalysis: 0
};

/**
 * Universal business logic extraction system for customer-facing teams
 */
interface BusinessDomain {
  productTerms: string[];
  serviceTypes: string[];
  geographicData: string[];
  pricingModels: string[];
  featureCategories: string[];
  processFlows: string[];
  constraints: string[];
  integrations: string[];
  customerTypes: string[];
  industryTerms: string[];
}

const businessDomain: BusinessDomain = {
  productTerms: [],
  serviceTypes: [],
  geographicData: [],
  pricingModels: [],
  featureCategories: [],
  processFlows: [],
  constraints: [],
  integrations: [],
  customerTypes: [],
  industryTerms: []
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
 * Initialize the knowledge base with dynamic codebase analysis
 */
export async function initializeKnowledgeBase(forceRefresh: boolean = false): Promise<void> {
  const now = Date.now();
  const timeSinceLastInit = now - initializationState.lastInitTime;
  
  // Check if we need to reinitialize
  if (!forceRefresh && 
      initializationState.initialized && 
      timeSinceLastInit < 5 * 60 * 1000 && // 5 minutes
      knowledgeBase.length > 0) {
    console.log('Knowledge base already initialized and recent, skipping reinitialization');
    return;
  }
  
  console.log('Initializing knowledge base with dynamic analysis...');
  initializationState.inProgress = true;
  initializationState.error = null;
  
  try {
    // Clear existing data
    knowledgeBase = [];
    clearProcessedFilesCache();
    clearSuccessfulPathPatterns();
    
    // Try to load from cache first
    if (loadFromCache()) {
      console.log('✅ Loaded knowledge base from cache');
      return;
    }
    
    // Check if we have a real repository
    const repo = getActiveRepository();
    if (repo) {
      console.log(`Analyzing repository: ${repo.owner}/${repo.repo}`);
      
      // Explore repository paths dynamically
      const success = await exploreRepositoryPaths(knowledgeBase);
      
      if (success && knowledgeBase.length > 0) {
        // Perform dynamic codebase analysis
        await analyzeCodebase(knowledgeBase);
        
        // Save to cache
        saveToCache();
        
        initializationState.usingMockData = false;
        initializationState.initialized = true;
        initializationState.lastInitTime = now;
        initializationState.lastRepositoryFingerprint = `${repo.owner}/${repo.repo}`;
        
        console.log(`✅ Knowledge base initialized with ${knowledgeBase.length} entries`);
        console.log(`📊 Codebase analysis complete for ${repo.owner}/${repo.repo}`);
      } else {
        throw new Error('Failed to explore repository or no files found');
      }
    } else {
      // Fall back to mock data if no repository
      console.log('No repository configured, using mock data');
      knowledgeBase = [...mockKnowledgeEntries];
      
      // Analyze mock data for demonstration
      await analyzeCodebase(knowledgeBase);
      
      initializationState.usingMockData = true;
      initializationState.initialized = true;
      initializationState.lastInitTime = now;
      
      console.log(`✅ Knowledge base initialized with mock data (${knowledgeBase.length} entries)`);
    }
    
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
    initializationState.error = error instanceof Error ? error.message : 'Unknown error';
    
    // Fall back to mock data on error
    console.log('Falling back to mock data due to error');
    knowledgeBase = [...mockKnowledgeEntries];
    await analyzeCodebase(knowledgeBase);
    
    initializationState.usingMockData = true;
    initializationState.initialized = true;
    initializationState.lastInitTime = now;
    
    console.log(`✅ Knowledge base initialized with mock data (${knowledgeBase.length} entries)`);
  } finally {
    initializationState.inProgress = false;
  }
}

/**
 * Enhanced semantic keyword matching for UI-related terms
 */
function getSemanticMatches(term: string): string[] {
  const semanticMap: Record<string, string[]> = {
    'subtitle': ['subheading', 'description', 'label', 'text', 'title', 'caption'],
    'settings': ['config', 'configuration', 'admin', 'preferences', 'options'],
    'membership': ['member', 'subscription', 'portal', 'signup', 'signup-form'],
    'portal': ['membership', 'signup', 'signup-form', 'admin-x-settings'],
    'component': ['ui', 'interface', 'element', 'widget', 'control'],
    'page': ['view', 'screen', 'interface', 'component'],
    'admin': ['settings', 'configuration', 'management', 'control']
  };
  
  const lowerTerm = term.toLowerCase();
  return semanticMap[lowerTerm] || [term];
}

/**
 * Enhanced file type scoring for UI questions
 */
function getFileTypeScore(filePath: string, isUIQuestion: boolean): number {
  if (!isUIQuestion) return 1.0;
  
  const fileName = filePath.toLowerCase();
  
  // Prioritize UI-specific file types
  if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return 2.0;
  if (fileName.endsWith('.hbs')) return 2.0;
  if (fileName.includes('locale') || fileName.includes('i18n')) return 1.5;
  if (fileName.endsWith('.json') && (fileName.includes('locale') || fileName.includes('i18n'))) return 1.5;
  
  // Deprioritize documentation and API files for UI questions
  if (fileName.includes('readme') || fileName.includes('docs/')) return 0.3;
  if (fileName.includes('api/') || fileName.includes('endpoints/')) return 0.5;
  
  return 1.0;
}

/**
 * Get dynamic path-based score multiplier based on codebase analysis
 */
function getPathBasedScore(filePath: string, keywords: string[]): number {
  const lowerPath = filePath.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  // Get directory importance from codebase analysis
  const dir = filePath.split('/')[0];
  const dirImportance = codebaseAnalysis.scoringWeights.directoryImportance[dir] || 0;
  
  // Base multiplier from directory importance
  let multiplier = 1.0 + (dirImportance * 2.0); // 1.0 to 3.0 range
  
  // Check for keyword matches in path
  const keywordMatches = lowerKeywords.filter(keyword => 
    lowerPath.includes(keyword)
  );
  
  if (keywordMatches.length > 0) {
    multiplier *= 1.5; // Boost for keyword matches in path
    console.log(`📁 Path keyword match for "${filePath}": ${keywordMatches.join(', ')}`);
  }
  
  // Check for common important directories
  const importantDirs = ['src', 'app', 'components', 'pages', 'services', 'api', 'utils', 'lib'];
  const isImportantDir = importantDirs.some(importantDir => 
    lowerPath.includes(importantDir)
  );
  
  if (isImportantDir) {
    multiplier *= 1.3; // Boost for important directories
  }
  
  // Check for UI-related paths for UI queries
  const uiKeywords = ['component', 'page', 'view', 'form', 'ui', 'interface'];
  const isUIQuery = lowerKeywords.some(keyword => uiKeywords.includes(keyword));
  
  if (isUIQuery) {
    const uiDirs = ['components', 'pages', 'views', 'ui', 'interface'];
    const isUIDir = uiDirs.some(uiDir => lowerPath.includes(uiDir));
    
    if (isUIDir) {
      multiplier *= 1.4; // Extra boost for UI directories on UI queries
    }
  }
  
  // Check for configuration-related paths for config queries
  const configKeywords = ['config', 'settings', 'options', 'preferences'];
  const isConfigQuery = lowerKeywords.some(keyword => configKeywords.includes(keyword));
  
  if (isConfigQuery) {
    const configDirs = ['config', 'settings', 'options', 'preferences'];
    const isConfigDir = configDirs.some(configDir => lowerPath.includes(configDir));
    
    if (isConfigDir) {
      multiplier *= 1.4; // Extra boost for config directories on config queries
    }
  }
  
  return multiplier;
}

/**
 * Get dynamic content analysis score based on codebase analysis
 */
function getContentAnalysisScore(content: string, keywords: string[]): number {
  const lowerContent = content.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  let score = 0;
  
  // Get domain-specific terms from codebase analysis
  const domainTerms = codebaseAnalysis.domainVocabulary.domainKeywords;
  const commonTerms = codebaseAnalysis.domainVocabulary.commonTerms;
  
  // Check for domain-specific content matches
  const domainMatches = domainTerms.filter(term => 
    lowerContent.includes(term.toLowerCase())
  );
  
  if (domainMatches.length > 0) {
    score += domainMatches.length * 3.0;
  }
  
  // Check for common terms in the codebase
  const commonMatches = commonTerms.filter(term => 
    lowerContent.includes(term.toLowerCase())
  );
  
  if (commonMatches.length > 0) {
    score += commonMatches.length * 1.5;
  }
  
  // Check for exact keyword matches
  const exactMatches = lowerKeywords.filter(keyword => 
    lowerContent.includes(keyword)
  );
  
  if (exactMatches.length > 0) {
    score += exactMatches.length * 2.0;
  }
  
  // Check for word boundary matches (more precise)
  for (const keyword of lowerKeywords) {
    const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (wordBoundaryRegex.test(content)) {
      score += 1.0;
    }
  }
  
  // Check for content patterns based on codebase analysis
  const contentPatterns = codebaseAnalysis.scoringWeights.contentPatterns;
  for (const [pattern, weight] of Object.entries(contentPatterns)) {
    if (lowerContent.includes(pattern)) {
      score += weight * 2.0;
    }
  }
  
  // Check for UI patterns in UI queries
  const uiKeywords = ['component', 'page', 'view', 'form', 'button', 'input', 'ui', 'interface'];
  const isUIQuery = lowerKeywords.some(keyword => uiKeywords.includes(keyword));
  
  if (isUIQuery) {
    const uiPatterns = ['className=', 'class=', '<div', '<span', '<button', '<input', 'onClick', 'onChange'];
    const uiMatches = uiPatterns.filter(pattern => lowerContent.includes(pattern));
    score += uiMatches.length * 1.0;
  }
  
  // Check for configuration patterns in config queries
  const configKeywords = ['config', 'settings', 'options', 'preferences', 'setup'];
  const isConfigQuery = lowerKeywords.some(keyword => configKeywords.includes(keyword));
  
  if (isConfigQuery) {
    const configPatterns = ['config', 'settings', 'options', 'preferences', 'default', 'value'];
    const configMatches = configPatterns.filter(pattern => lowerContent.includes(pattern));
    score += configMatches.length * 1.0;
  }
  
  // Check for API patterns in API queries
  const apiKeywords = ['api', 'endpoint', 'request', 'response', 'fetch', 'http'];
  const isAPIQuery = lowerKeywords.some(keyword => apiKeywords.includes(keyword));
  
  if (isAPIQuery) {
    const apiPatterns = ['api', 'fetch', 'axios', 'http', 'request', 'response', 'endpoint'];
    const apiMatches = apiPatterns.filter(pattern => lowerContent.includes(pattern));
    score += apiMatches.length * 1.0;
  }
  
  return score;
}

/**
 * Quick codebase detector to determine optimal patterns
 */
function detectCodebaseType(knowledgeBase: KnowledgeEntry[]): 'ghost' | 'react' | 'nextjs' | 'vue' | 'generic' {
  const paths = knowledgeBase.map(entry => entry.filePath.toLowerCase());
  const content = knowledgeBase.map(entry => entry.content.toLowerCase()).join(' ');
  
  // Ghost-specific patterns
  if (paths.some(path => path.includes('apps/admin-x-settings') || path.includes('ghost/core'))) {
    console.log('🎭 Detected Ghost codebase');
    return 'ghost';
  }
  
  // React patterns
  if (paths.some(path => path.includes('src/components') || path.includes('components/')) || 
      content.includes('import react') || content.includes('from react')) {
    console.log('⚛️ Detected React codebase');
    return 'react';
  }
  
  // Next.js patterns
  if (paths.some(path => path.includes('pages/') || path.includes('app/')) || 
      content.includes('next/link') || content.includes('next/router')) {
    console.log('▲ Detected Next.js codebase');
    return 'nextjs';
  }
  
  // Vue patterns
  if (paths.some(path => path.includes('.vue')) || content.includes('import vue')) {
    console.log('💚 Detected Vue codebase');
    return 'vue';
  }
  
  console.log('🌐 Using generic patterns');
  return 'generic';
}

/**
 * Enhanced content extraction focusing on complete text content
 */
function extractCompleteTextContent(content: string, filePath: string): string[] {
  const textBlocks: string[] = [];
  
  // Extract JSX text content (text between tags)
  const jsxTextMatches = content.match(/>([^<>{}\n]+)</g);
  if (jsxTextMatches) {
    jsxTextMatches.forEach(match => {
      const text = match.replace(/[<>]/g, '').trim();
      if (text.length > 3 && !text.match(/^[a-z]+$/)) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract string literals that look like descriptions
  const stringLiteralMatches = content.match(/"([^"]{10,})"/g);
  if (stringLiteralMatches) {
    stringLiteralMatches.forEach(match => {
      const text = match.replace(/"/g, '').trim();
      if (text.length > 10 && !text.includes('http') && !text.includes('className')) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract template literals
  const templateLiteralMatches = content.match(/`([^`]{10,})`/g);
  if (templateLiteralMatches) {
    templateLiteralMatches.forEach(match => {
      const text = match.replace(/`/g, '').trim();
      if (text.length > 10 && !text.includes('${')) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract comments that might contain descriptions
  const commentMatches = content.match(/\/\*([^*]+)\*\//g);
  if (commentMatches) {
    commentMatches.forEach(match => {
      const text = match.replace(/\/\*|\*\//g, '').trim();
      if (text.length > 10) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract JSX attributes that might contain descriptions
  const jsxAttributeMatches = content.match(/(title="([^"]+)"|alt="([^"]+)"|aria-label="([^"]+)")/g);
  if (jsxAttributeMatches) {
    jsxAttributeMatches.forEach(match => {
      const text = match.replace(/title="|alt="|aria-label="|"/g, '').trim();
      if (text.length > 5) {
        textBlocks.push(text);
      }
    });
  }
  
  return [...new Set(textBlocks)]; // Remove duplicates
}

/**
 * Hybrid intent detection with Ghost optimization and generic fallbacks
 */
function detectQueryIntent(originalQuestion: string, keywords: string[]): 'ui' | 'api' | 'auth' | 'data' | 'business' | 'performance' | 'integration' | 'configuration' | 'general' {
  const lowerQuestion = originalQuestion.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  console.log(`🔍 Analyzing query intent for: "${originalQuestion}"`);
  console.log(`🔍 Keywords: ${keywords.join(', ')}`);
  
  // Ghost-specific patterns (but generalizable)
  const ghostUIKeywords = ['portal', 'membership', 'admin', 'settings', 'subtitle', 'description', 'copy'];
  const ghostUIMatches = ghostUIKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (ghostUIMatches.length > 0) {
    console.log(`🎭 Detected Ghost UI intent: ${ghostUIMatches.join(', ')}`);
    return 'ui';
  }
  
  // Generic UI Intent detection
  const uiKeywords = ['component', 'page', 'form', 'button', 'input', 'layout', 'style', 'design', 'css', 'scss', 'html', 'jsx', 'vue', 'render', 'display', 'view', 'interface', 'ui'];
  const uiMatches = uiKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (uiMatches.length > 0) {
    console.log(`🎨 Detected UI intent: ${uiMatches.join(', ')}`);
    return 'ui';
  }
  
  // API Intent detection
  const apiKeywords = ['api', 'endpoint', 'request', 'response', 'fetch', 'axios', 'http', 'rest', 'graphql', 'controller', 'route', 'handler'];
  const apiMatches = apiKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (apiMatches.length > 0) {
    console.log(`🔌 Detected API intent: ${apiMatches.join(', ')}`);
    return 'api';
  }
  
  // Auth Intent detection
  const authKeywords = ['login', 'signup', 'signin', 'logout', 'authentication', 'authorization', 'auth', 'user', 'session', 'password', 'token', 'jwt', 'oauth', 'permission', 'role'];
  const authMatches = authKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (authMatches.length > 0) {
    console.log(`🔐 Detected Auth intent: ${authMatches.join(', ')}`);
    return 'auth';
  }
  
  // Data Intent detection
  const dataKeywords = ['database', 'model', 'schema', 'query', 'store', 'save', 'fetch', 'data', 'table', 'collection', 'document', 'record', 'entity', 'orm', 'migration'];
  const dataMatches = dataKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (dataMatches.length > 0) {
    console.log(`💾 Detected Data intent: ${dataMatches.join(', ')}`);
    return 'data';
  }
  
  // Business Intent detection
  const businessKeywords = ['payment', 'subscription', 'billing', 'invoice', 'order', 'purchase', 'transaction', 'business', 'logic', 'process', 'workflow', 'rule', 'policy', 'calculation'];
  const businessMatches = businessKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (businessMatches.length > 0) {
    console.log(`💼 Detected Business intent: ${businessMatches.join(', ')}`);
    return 'business';
  }
  
  // Performance Intent detection
  const performanceKeywords = ['slow', 'fast', 'optimize', 'cache', 'speed', 'performance', 'efficient', 'memory', 'cpu', 'load', 'timeout', 'bottleneck', 'profiling'];
  const performanceMatches = performanceKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (performanceMatches.length > 0) {
    console.log(`⚡ Detected Performance intent: ${performanceMatches.join(', ')}`);
    return 'performance';
  }
  
  // Integration Intent detection
  const integrationKeywords = ['email', 'webhook', 'service', 'external', 'third-party', 'integration', 'webhook', 'notification', 'sms', 'push', 'slack', 'stripe', 'aws', 'cloud'];
  const integrationMatches = integrationKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (integrationMatches.length > 0) {
    console.log(`🔗 Detected Integration intent: ${integrationMatches.join(', ')}`);
    return 'integration';
  }
  
  // Configuration Intent detection
  const configKeywords = ['config', 'settings', 'options', 'preferences', 'setup', 'configure', 'customize', 'environment', 'env', 'deployment'];
  const configMatches = configKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (configMatches.length > 0) {
    console.log(`⚙️ Detected Configuration intent: ${configMatches.join(', ')}`);
    return 'configuration';
  }
  
  console.log(`🔍 Detected General intent - no specific patterns matched`);
  return 'general';
}

/**
 * Hybrid intent-based scoring with Ghost optimization and generic fallbacks
 */
function getIntentBasedScoring(intent: 'ui' | 'api' | 'auth' | 'data' | 'business' | 'performance' | 'integration' | 'configuration' | 'general', filePath: string, fileName: string, content: string): number {
  const lowerPath = filePath.toLowerCase();
  const lowerName = fileName.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Detect codebase type for adaptive scoring
  const codebaseType = detectCodebaseType([{ filePath, content, keywords: [], type: 'content' }]);
  
  console.log(`🎯 Applying ${codebaseType}-optimized scoring for ${intent} intent on ${fileName}`);
  
  switch (intent) {
    case 'ui':
      // Ghost-optimized UI scoring
      if (codebaseType === 'ghost') {
        if (lowerPath.includes('admin-x-settings') || lowerPath.includes('portal') || lowerPath.includes('membership')) return 0.9;
        if (lowerPath.includes('component') || lowerPath.includes('page') || lowerPath.includes('view')) return 0.8;
        if (['.tsx', '.jsx', '.vue', '.css', '.scss', '.html'].some(ext => lowerName.endsWith(ext))) return 0.7;
        if (lowerContent.includes('portal') || lowerContent.includes('membership') || lowerContent.includes('settings')) return 0.6;
      } else {
        // Generic UI scoring
        if (lowerPath.includes('component') || lowerPath.includes('page') || lowerPath.includes('view')) return 0.8;
        if (['.tsx', '.jsx', '.vue', '.css', '.scss', '.html'].some(ext => lowerName.endsWith(ext))) return 0.6;
        if (lowerPath.includes('ui/') || lowerPath.includes('components/') || lowerPath.includes('pages/')) return 0.7;
        if (lowerContent.includes('jsx') || lowerContent.includes('html') || lowerContent.includes('css')) return 0.5;
      }
      return 0.2;
      
    case 'api':
      // API intent: prioritize backend/API files
      if (lowerPath.includes('api/') || lowerPath.includes('routes/') || lowerPath.includes('endpoints/')) return 0.9;
      if (lowerName.includes('controller') || lowerName.includes('route') || lowerName.includes('handler')) return 0.8;
      if (['.controller.js', '.controller.ts', '.route.js', '.route.ts'].some(ext => lowerName.endsWith(ext))) return 0.8;
      if (lowerContent.includes('router') || lowerContent.includes('endpoint') || lowerContent.includes('api')) return 0.6;
      if (lowerPath.includes('server/') || lowerPath.includes('backend/')) return 0.7;
      return 0.2;
      
    case 'auth':
      // Auth intent: prioritize authentication-related files
      if (lowerPath.includes('auth/') || lowerPath.includes('login/') || lowerPath.includes('user/') || lowerPath.includes('session/')) return 0.9;
      if (lowerName.includes('auth') || lowerName.includes('login') || lowerName.includes('user') || lowerName.includes('session')) return 0.8;
      if (lowerContent.includes('authentication') || lowerContent.includes('authorization') || lowerContent.includes('login')) return 0.7;
      if (lowerContent.includes('password') || lowerContent.includes('token') || lowerContent.includes('jwt')) return 0.6;
      return 0.2;
      
    case 'data':
      // Data intent: prioritize database/model files
      if (lowerPath.includes('model/') || lowerPath.includes('schema/') || lowerPath.includes('database/')) return 0.9;
      if (lowerName.includes('model') || lowerName.includes('schema') || lowerName.includes('entity')) return 0.8;
      if (['.model.js', '.model.ts', '.schema.js', '.schema.ts'].some(ext => lowerName.endsWith(ext))) return 0.8;
      if (lowerContent.includes('database') || lowerContent.includes('query') || lowerContent.includes('schema')) return 0.6;
      if (lowerPath.includes('db/') || lowerPath.includes('data/')) return 0.7;
      return 0.2;
      
    case 'business':
      // Business intent: prioritize business logic files
      if (lowerPath.includes('service/') || lowerPath.includes('business/') || lowerPath.includes('logic/')) return 0.9;
      if (lowerName.includes('service') || lowerName.includes('business') || lowerName.includes('logic')) return 0.8;
      if (['.service.js', '.service.ts', '.business.js', '.business.ts'].some(ext => lowerName.endsWith(ext))) return 0.8;
      if (lowerContent.includes('payment') || lowerContent.includes('billing') || lowerContent.includes('subscription')) return 0.7;
      if (lowerContent.includes('business') || lowerContent.includes('logic') || lowerContent.includes('process')) return 0.6;
      return 0.2;
      
    case 'performance':
      // Performance intent: prioritize optimization/cache files
      if (lowerPath.includes('cache/') || lowerPath.includes('optimize/') || lowerPath.includes('performance/')) return 0.9;
      if (lowerName.includes('cache') || lowerName.includes('optimize') || lowerName.includes('performance')) return 0.8;
      if (lowerContent.includes('cache') || lowerContent.includes('optimize') || lowerContent.includes('performance')) return 0.7;
      if (lowerContent.includes('memory') || lowerContent.includes('cpu') || lowerContent.includes('speed')) return 0.6;
      return 0.2;
      
    case 'integration':
      // Integration intent: prioritize external service files
      if (lowerPath.includes('integration/') || lowerPath.includes('webhook/') || lowerPath.includes('external/')) return 0.9;
      if (lowerName.includes('webhook') || lowerName.includes('integration') || lowerName.includes('external')) return 0.8;
      if (lowerContent.includes('webhook') || lowerContent.includes('integration') || lowerContent.includes('external')) return 0.7;
      if (lowerContent.includes('email') || lowerContent.includes('slack') || lowerContent.includes('stripe')) return 0.6;
      return 0.2;
      
    case 'configuration':
      // Configuration intent: prioritize config/settings files
      if (lowerPath.includes('config/') || lowerPath.includes('settings/') || lowerPath.includes('env/')) return 0.9;
      if (lowerName.includes('config') || lowerName.includes('settings') || lowerName.includes('env')) return 0.8;
      if (['.config.js', '.config.ts', '.env', '.settings.js', '.settings.ts'].some(ext => lowerName.endsWith(ext))) return 0.8;
      if (lowerContent.includes('config') || lowerContent.includes('settings') || lowerContent.includes('environment')) return 0.6;
      return 0.2;
      
    case 'general':
    default:
      // General intent: balanced scoring without bias
      return 0.3;
  }
}

/**
 * Dynamic scoring based on codebase analysis and query intent
 */
function getDynamicScoringBonus(entry: KnowledgeEntry, keywords: string[], intent: 'ui' | 'configuration' | 'api' | 'data' | 'general'): number {
  let bonus = 0;
  const lowerContent = entry.content.toLowerCase();
  const lowerFilePath = entry.filePath.toLowerCase();
  
  // Get domain-specific terms from codebase analysis
  const domainTerms = codebaseAnalysis.domainVocabulary.domainKeywords;
  const commonTerms = codebaseAnalysis.domainVocabulary.commonTerms;
  
  // Check for domain-specific content matches
  const domainMatches = domainTerms.filter(term => 
    lowerContent.includes(term.toLowerCase()) || lowerFilePath.includes(term.toLowerCase())
  );
  
  if (domainMatches.length > 0) {
    bonus += domainMatches.length * 5;
    console.log(`🎯 Domain match bonus for "${entry.filePath}": +${domainMatches.length * 5} points (${domainMatches.join(', ')})`);
  }
  
  // Check for common terms in the codebase
  const commonMatches = commonTerms.filter(term => 
    lowerContent.includes(term.toLowerCase())
  );
  
  if (commonMatches.length > 0) {
    bonus += commonMatches.length * 2;
    console.log(`📝 Common term bonus for "${entry.filePath}": +${commonMatches.length * 2} points`);
  }
  
  // Intent-specific scoring
  switch (intent) {
    case 'ui':
      // Boost UI-related files and content
      if (entry.filePath.endsWith('.tsx') || entry.filePath.endsWith('.jsx') || entry.filePath.endsWith('.vue') || entry.filePath.endsWith('.html')) {
        bonus += 15;
        console.log(`🎨 UI file bonus for "${entry.filePath}": +15 points`);
      }
      
      if (lowerContent.includes('className=') || lowerContent.includes('class=') || lowerContent.includes('<div') || lowerContent.includes('<span')) {
        bonus += 10;
        console.log(`🎨 UI content bonus for "${entry.filePath}": +10 points`);
      }
      break;
      
    case 'configuration':
      // Boost configuration-related files and content
      if (lowerFilePath.includes('config') || lowerFilePath.includes('settings') || lowerFilePath.includes('options')) {
        bonus += 15;
        console.log(`⚙️ Config file bonus for "${entry.filePath}": +15 points`);
      }
      
      if (lowerContent.includes('config') || lowerContent.includes('settings') || lowerContent.includes('options')) {
        bonus += 10;
        console.log(`⚙️ Config content bonus for "${entry.filePath}": +10 points`);
      }
      break;
      
    case 'api':
      // Boost API-related files and content
      if (lowerFilePath.includes('api') || lowerFilePath.includes('service') || lowerFilePath.includes('client')) {
        bonus += 15;
        console.log(`🔌 API file bonus for "${entry.filePath}": +15 points`);
      }
      
      if (lowerContent.includes('api') || lowerContent.includes('fetch') || lowerContent.includes('axios') || lowerContent.includes('http')) {
        bonus += 10;
        console.log(`🔌 API content bonus for "${entry.filePath}": +10 points`);
      }
      break;
      
    case 'data':
      // Boost data-related files and content
      if (lowerFilePath.includes('model') || lowerFilePath.includes('schema') || lowerFilePath.includes('data')) {
        bonus += 15;
        console.log(`💾 Data file bonus for "${entry.filePath}": +15 points`);
      }
      
      if (lowerContent.includes('model') || lowerContent.includes('schema') || lowerContent.includes('database')) {
        bonus += 10;
        console.log(`💾 Data content bonus for "${entry.filePath}": +10 points`);
      }
      break;
      
    case 'general':
      // No specific bonuses for general queries
      break;
  }
  
  // Directory importance bonus based on codebase analysis
  const dir = entry.filePath.split('/')[0];
  const dirImportance = codebaseAnalysis.scoringWeights.directoryImportance[dir] || 0;
  if (dirImportance > 0.5) {
    bonus += Math.floor(dirImportance * 10);
    console.log(`📁 Directory importance bonus for "${entry.filePath}": +${Math.floor(dirImportance * 10)} points`);
  }
  
  return bonus;
}

/**
 * Enhanced search with Ghost optimization, universal fallbacks, and business logic extraction
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const originalKeywords = extractKeywords(query);
  
  if (originalKeywords.length === 0) {
    return [];
  }
  
  // Store original question for query type detection
  const originalQuestion = query.toLowerCase();
  console.log(`🔍 Original question: "${query}"`);
  console.log(`🔍 Original keywords: ${originalKeywords.join(', ')}`);
  
  // Check if this is a business question that should use specialized business search
  const businessIntent = detectBusinessIntent(originalQuestion, originalKeywords);
  const isBusinessQuestion = businessIntent !== 'general';
  
  if (isBusinessQuestion) {
    console.log(`💼 Detected business question with intent: ${businessIntent}`);
    console.log(`💼 Business questions should use searchKnowledgeEnhanced for better results`);
    // For now, continue with regular search but log that business search would be better
  }
  
  // Detect query intent for proper file targeting
  const queryIntent = detectQueryIntent(originalQuestion, originalKeywords);
  console.log(`🎯 Detected query intent: ${queryIntent}`);
  
  // Detect codebase type for adaptive patterns
  const codebaseType = detectCodebaseType(knowledgeBase);
  console.log(`🏗️ Detected codebase type: ${codebaseType}`);
  
  console.log(`🔍 Enhanced search: ${originalKeywords.join(', ')} across ${knowledgeBase.length} entries`);
  console.log(`📊 Using mock data: ${initializationState.usingMockData}`);
  
  // Enhanced scoring algorithm with Ghost optimization and universal fallbacks
  const scoredEntries = knowledgeBase.map(entry => {
    let score = 0;
    
    // Use expanded keywords for file content matching
    const expandedKeywords = originalKeywords.flatMap(k => [k, ...getSemanticMatches(k)]);
    
    // Exact keyword matches (highest weight)
    expandedKeywords.forEach(keyword => {
      if (entry.keywords.includes(keyword)) {
        score += 2.0;
      }
      
      // Content matches (medium weight)
      const lowerContent = entry.content.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      
      if (lowerContent.includes(lowerKeyword)) {
        score += 1.0;
        
        // Bonus for exact word matches
        const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
        if (wordBoundaryRegex.test(lowerContent)) {
          score += 0.5;
        }
      }
      
      // File path matches (lower weight)
      if (entry.filePath.toLowerCase().includes(lowerKeyword)) {
        score += 0.5;
      }
      
      // Metadata matches (if available)
      if (entry.metadata && typeof entry.metadata === 'object') {
        try {
          const metadataStr = safeStringify(entry.metadata).toLowerCase();
          if (metadataStr.includes(lowerKeyword)) {
            score += 0.3;
          }
        } catch (error) {
          console.warn('Failed to stringify metadata for search:', error);
          // Continue without metadata matching
        }
      }
    });
    
    // Apply intent-based scoring with codebase detection
    const intentScore = getIntentBasedScoring(queryIntent, entry.filePath, entry.filePath.split('/').pop() || '', entry.content);
    score += intentScore;
    
    // Apply path-based scoring
    const pathScore = getPathBasedScore(entry.filePath, originalKeywords);
    score *= pathScore;
    
    // Apply content analysis scoring
    const contentScore = getContentAnalysisScore(entry.content, originalKeywords);
    score += contentScore;
    
    // Special bonus for Ghost subtitle questions
    if (codebaseType === 'ghost' && queryIntent === 'ui') {
      const subtitleKeywords = ['subtitle', 'description', 'copy', 'text'];
      const isSubtitleQuestion = subtitleKeywords.some(keyword => originalQuestion.includes(keyword));
      
      if (isSubtitleQuestion) {
        // Extract complete text content for subtitle questions
        const textBlocks = extractCompleteTextContent(entry.content, entry.filePath);
        const hasRelevantText = textBlocks.some(text => 
          subtitleKeywords.some(keyword => text.toLowerCase().includes(keyword)) ||
          originalKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        if (hasRelevantText) {
          score += 2.0; // Significant bonus for files with relevant text content
          console.log(`🎭 Ghost subtitle bonus for ${entry.filePath}: found ${textBlocks.length} text blocks`);
        }
      }
    }
    
    // Business logic bonus for business questions
    if (isBusinessQuestion) {
      const businessLogic = extractUniversalBusinessLogic(entry.content, entry.filePath);
      if (businessLogic.length > 0) {
        const businessRelevance = businessLogic.some(logic => 
          originalKeywords.some(keyword => logic.toLowerCase().includes(keyword.toLowerCase()))
        );
        if (businessRelevance) {
          score += 1.5; // Bonus for files with relevant business logic
          console.log(`💼 Business logic bonus for ${entry.filePath}: found ${businessLogic.length} business rules`);
        }
      }
    }
    
    return {
      entry,
      score: score / originalKeywords.length,
      boosts: {
        intent: intentScore,
        path: pathScore,
        content: contentScore
      }
    };
  });
  
  // Enhanced filtering and sorting
  const results = scoredEntries
    .filter(item => item.score > 0.02) // Lower threshold for better recall
    .sort((a, b) => b.score - a.score)
    .slice(0, 20) // Increase result limit
    .map(item => {
      // Log significant boosts for debugging
      if (item.boosts.path > 1.5 || item.boosts.content > 2.0) {
        console.log(`🚀 High-scoring result: ${item.entry.filePath} (score: ${item.score.toFixed(2)})`);
        console.log(`   - Intent boost: +${item.boosts.intent.toFixed(2)}`);
        console.log(`   - Path boost: ${item.boosts.path.toFixed(2)}x`);
        console.log(`   - Content boost: +${item.boosts.content.toFixed(2)}`);
      }
      return item.entry;
    });
  
  console.log(`✅ Enhanced search found ${results.length} results`);
  console.log(`📈 Top scores: ${scoredEntries.filter(s => s.score > 0.02).slice(0, 3).map(s => `${s.entry.filePath.split('/').pop()}: ${s.score.toFixed(2)}`).join(', ')}`);
  
  return results;
}

/**
 * Clear the knowledge base
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
      comment: 0,
      function: 0,
      export: 0,
      content: 0,
      page: 0,
      config: 0,
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

/**
 * Dynamically analyze the codebase structure and patterns
 */
async function analyzeCodebase(knowledgeBase: KnowledgeEntry[]): Promise<void> {
  console.log(`🔍 Starting dynamic codebase analysis...`);
  
  const now = Date.now();
  
  // Skip if analysis is recent
  if (codebaseAnalysis.lastAnalysis && (now - codebaseAnalysis.lastAnalysis) < 5 * 60 * 1000) {
    console.log('Codebase analysis is recent, skipping reanalysis');
    return;
  }
  
  // Reset analysis
  codebaseAnalysis = {
    projectStructure: {
      mainDirectories: [],
      technologyStack: [],
      fileExtensions: [],
      commonPatterns: []
    },
    domainVocabulary: {
      commonTerms: [],
      domainKeywords: [],
      componentPatterns: []
    },
    scoringWeights: {
      directoryImportance: {},
      fileTypeRelevance: {},
      contentPatterns: {}
    },
    lastAnalysis: now
  };
  
  // Extract patterns from file paths and content
  const technologyStack = new Set<string>();
  
  for (const entry of knowledgeBase) {
    // Extract directory structure
    const pathParts = entry.filePath.split('/');
    if (pathParts.length > 0) {
      const mainDir = pathParts[0];
      if (!codebaseAnalysis.projectStructure.mainDirectories.includes(mainDir)) {
        codebaseAnalysis.projectStructure.mainDirectories.push(mainDir);
      }
    }
    
    // Extract file extensions
    const extension = entry.filePath.split('.').pop()?.toLowerCase();
    if (extension && !codebaseAnalysis.projectStructure.fileExtensions.includes(extension)) {
      codebaseAnalysis.projectStructure.fileExtensions.push(extension);
    }
    
    // Detect technology stack
    if (entry.content.includes('import React') || entry.content.includes('from react')) {
      technologyStack.add('react');
    }
    if (entry.content.includes('import Vue') || entry.content.includes('from vue')) {
      technologyStack.add('vue');
    }
    if (entry.content.includes('import angular') || entry.content.includes('from angular')) {
      technologyStack.add('angular');
    }
    if (entry.content.includes('from django') || entry.content.includes('django.db')) {
      technologyStack.add('django');
    }
  }
  
  // Analyze domain vocabulary
  const allContent = knowledgeBase.map(entry => entry.content).join(' ');
  const words = allContent.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Count word frequency
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  
  // Extract common terms (appearing more than 5 times)
  codebaseAnalysis.domainVocabulary.commonTerms = Array.from(wordCount.entries())
    .filter(([_, count]) => count > 5)
    .map(([word, _]) => word)
    .slice(0, 50);
  
  // Extract domain keywords (capitalized words)
  const capitalizedWords = allContent.match(/\b[A-Z][a-z]+[A-Z][a-z]*\b/g) || [];
  const domainKeywords = [...new Set(capitalizedWords)].slice(0, 30);
  codebaseAnalysis.domainVocabulary.domainKeywords = domainKeywords;
  
  // Extract component patterns
  codebaseAnalysis.domainVocabulary.componentPatterns = extractComponentPatterns(knowledgeBase);
  
  // Calculate directory importance based on file count
  const directoryFileCount = new Map<string, number>();
  for (const entry of knowledgeBase) {
    const dir = entry.filePath.split('/')[0];
    directoryFileCount.set(dir, (directoryFileCount.get(dir) || 0) + 1);
  }
  
  // Normalize directory importance
  const maxFiles = Math.max(...directoryFileCount.values());
  for (const [dir, count] of directoryFileCount.entries()) {
    codebaseAnalysis.scoringWeights.directoryImportance[dir] = count / maxFiles;
  }
  
  // Calculate file type relevance
  const fileExtensions = new Set(codebaseAnalysis.projectStructure.fileExtensions);
  codebaseAnalysis.scoringWeights.fileTypeRelevance = calculateFileTypeRelevance(fileExtensions);
  
  // Calculate content pattern weights
  codebaseAnalysis.scoringWeights.contentPatterns = calculateContentPatternWeights(knowledgeBase);
  
  console.log(`✅ Codebase analysis complete:`);
  console.log(`   - Main directories: ${codebaseAnalysis.projectStructure.mainDirectories.join(', ')}`);
  console.log(`   - Technology stack: ${Array.from(technologyStack).join(', ')}`);
  console.log(`   - File extensions: ${codebaseAnalysis.projectStructure.fileExtensions.join(', ')}`);
  console.log(`   - Common terms: ${codebaseAnalysis.domainVocabulary.commonTerms.slice(0, 10).join(', ')}`);
  console.log(`   - Domain keywords: ${codebaseAnalysis.domainVocabulary.domainKeywords.slice(0, 10).join(', ')}`);
}

/**
 * Extract common patterns from the codebase
 */
function extractCommonPatterns(knowledgeBase: KnowledgeEntry[]): string[] {
  const patterns = new Set<string>();
  
  for (const entry of knowledgeBase) {
    // Look for common naming patterns
    const fileName = entry.filePath.split('/').pop() || '';
    
    if (fileName.includes('component') || fileName.includes('Component')) {
      patterns.add('react-components');
    }
    if (fileName.includes('service') || fileName.includes('Service')) {
      patterns.add('services');
    }
    if (fileName.includes('model') || fileName.includes('Model')) {
      patterns.add('models');
    }
    if (fileName.includes('controller') || fileName.includes('Controller')) {
      patterns.add('controllers');
    }
    if (fileName.includes('util') || fileName.includes('Util')) {
      patterns.add('utilities');
    }
    if (fileName.includes('hook') || fileName.includes('Hook')) {
      patterns.add('hooks');
    }
    if (fileName.includes('config') || fileName.includes('Config')) {
      patterns.add('configuration');
    }
    if (entry.content.includes('function') || entry.content.includes('const') || entry.content.includes('export')) {
      patterns.add('functions');
    }
  }
  
  return Array.from(patterns);
}

/**
 * Extract domain-specific keywords
 */
function extractDomainKeywords(knowledgeBase: KnowledgeEntry[]): string[] {
  const keywords = new Set<string>();
  
  for (const entry of knowledgeBase) {
    // Extract capitalized words (likely domain terms)
    const capitalizedWords = entry.content.match(/\b[A-Z][a-z]+[A-Z][a-z]*\b/g) || [];
    capitalizedWords.forEach(word => {
      if (word.length > 3) {
        keywords.add(word);
      }
    });
    
    // Extract common domain patterns
    const domainPatterns = [
      'User', 'Member', 'Subscription', 'Payment', 'Order', 'Product',
      'Service', 'Component', 'Page', 'Route', 'API', 'Database',
      'Model', 'Controller', 'Repository', 'Manager', 'Handler'
    ];
    
    domainPatterns.forEach(pattern => {
      if (entry.content.includes(pattern)) {
        keywords.add(pattern);
      }
    });
  }
  
  return Array.from(keywords).slice(0, 30);
}

/**
 * Extract component patterns
 */
function extractComponentPatterns(knowledgeBase: KnowledgeEntry[]): string[] {
  const patterns = new Set<string>();
  
  for (const entry of knowledgeBase) {
    if (entry.filePath.endsWith('.tsx') || entry.filePath.endsWith('.jsx') || entry.filePath.endsWith('.vue')) {
      // React component patterns
      if (entry.content.includes('function') && entry.content.includes('return')) {
        patterns.add('functional-components');
      }
      if (entry.content.includes('class') && entry.content.includes('extends')) {
        patterns.add('class-components');
      }
      if (entry.content.includes('useState') || entry.content.includes('useEffect')) {
        patterns.add('hooks');
      }
      if (entry.content.includes('props') || entry.content.includes('children')) {
        patterns.add('props-pattern');
      }
    }
    
    if (entry.filePath.endsWith('.vue')) {
      // Vue component patterns
      if (entry.content.includes('<template>') || entry.content.includes('<script>')) {
        patterns.add('vue-component');
      }
    }
  }
  
  return Array.from(patterns);
}

/**
 * Calculate file type relevance weights
 */
function calculateFileTypeRelevance(fileExtensions: Set<string>): Record<string, number> {
  const weights: Record<string, number> = {};
  
  // UI-related files get higher weights
  const uiExtensions = ['tsx', 'jsx', 'vue', 'html', 'css', 'scss'];
  const configExtensions = ['json', 'yaml', 'yml', 'config', 'env'];
  const docExtensions = ['md', 'txt', 'readme'];
  
  for (const ext of fileExtensions) {
    if (uiExtensions.includes(ext)) {
      weights[ext] = 2.0;
    } else if (configExtensions.includes(ext)) {
      weights[ext] = 1.5;
    } else if (docExtensions.includes(ext)) {
      weights[ext] = 0.8;
    } else {
      weights[ext] = 1.0;
    }
  }
  
  return weights;
}

/**
 * Calculate content pattern weights
 */
function calculateContentPatternWeights(knowledgeBase: KnowledgeEntry[]): Record<string, number> {
  const weights: Record<string, number> = {};
  
  // Analyze content patterns and their frequency
  const patternCounts = new Map<string, number>();
  
  for (const entry of knowledgeBase) {
    const content = entry.content.toLowerCase();
    
    // Count different content patterns
    if (content.includes('function') || content.includes('const') || content.includes('let')) {
      patternCounts.set('functions', (patternCounts.get('functions') || 0) + 1);
    }
    if (content.includes('import') || content.includes('export')) {
      patternCounts.set('modules', (patternCounts.get('modules') || 0) + 1);
    }
    if (content.includes('class') || content.includes('interface')) {
      patternCounts.set('classes', (patternCounts.get('classes') || 0) + 1);
    }
    if (content.includes('api') || content.includes('fetch') || content.includes('axios')) {
      patternCounts.set('api', (patternCounts.get('api') || 0) + 1);
    }
    if (content.includes('database') || content.includes('query') || content.includes('model')) {
      patternCounts.set('database', (patternCounts.get('database') || 0) + 1);
    }
  }
  
  // Normalize weights
  const maxCount = Math.max(...patternCounts.values());
  patternCounts.forEach((count, pattern) => {
    weights[pattern] = count / maxCount;
  });
  
  return weights;
}

/**
 * Expand keywords with semantic matches for broader search
 */
function expandKeywords(keywords: string[]): string[] {
  const expanded: string[] = [];
  
  for (const keyword of keywords) {
    expanded.push(keyword);
    // Add semantic matches
    const semanticMatches = getSemanticMatches(keyword);
    expanded.push(...semanticMatches);
  }
  
  return [...new Set(expanded)]; // Remove duplicates
}

/**
 * Calculate path relevance score based on directory structure
 */
function getPathRelevanceScore(filePath: string, keywords: string[]): number {
  const lowerPath = filePath.toLowerCase();
  let score = 0;
  
  // Check for keyword matches in path
  for (const keyword of keywords) {
    if (lowerPath.includes(keyword.toLowerCase())) {
      score += 0.4;
    }
  }
  
  // Boost for common relevant directories
  const relevantDirs = ['src/', 'app/', 'components/', 'pages/', 'services/', 'api/', 'models/', 'utils/'];
  for (const dir of relevantDirs) {
    if (lowerPath.includes(dir)) {
      score += 0.2;
      break;
    }
  }
  
  return score;
}

/**
 * Calculate content relevance score based on keyword density
 */
function getContentRelevanceScore(content: string, keywords: string[]): number {
  const lowerContent = content.toLowerCase();
  let score = 0;
  
  // Check for keyword matches in content
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerContent.includes(lowerKeyword)) {
      score += 0.3;
      
      // Bonus for exact word matches
      const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerContent)) {
        score += 0.2;
      }
    }
  }
  
  return score;
}

// Re-export types for external use
export type { KnowledgeEntry, KnowledgeBaseStats } from './types';

/**
 * Test function to verify Ghost subtitle functionality and universality
 */
export async function testGhostAndUniversality(): Promise<void> {
  console.log('🧪 Testing Ghost Subtitle Functionality and Universality...');
  
  // Test Ghost-specific questions
  const ghostQuestions = [
    "What's the copy under Portal Settings?",
    "What's the subtitle for Portal Settings?",
    "What's the description under Portal Settings?",
    "Show me the text under Portal Settings?",
    "What does it say under Portal Settings?",
    "What's the copy for membership settings?",
    "What's the subtitle for membership?",
    "Show me the admin settings description"
  ];
  
  console.log('\n🎭 Testing Ghost-specific questions:');
  for (const question of ghostQuestions) {
    console.log(`\n🔍 Testing: "${question}"`);
    const intent = detectQueryIntent(question, extractKeywords(question));
    console.log(`🎯 Detected intent: ${intent}`);
    
    const results = searchKnowledge(question);
    console.log(`📊 Found ${results.length} results`);
    
    if (results.length > 0) {
      console.log(`🏆 Top result: ${results[0].filePath}`);
      console.log(`📝 Content preview: ${results[0].content.substring(0, 100)}...`);
    }
  }
  
  // Test generic questions that should work with any codebase
  const genericQuestions = [
    "What does the login form look like?",
    "Show me the user settings component",
    "What are the API endpoints?",
    "How is authentication implemented?",
    "What's the database schema?",
    "How are payments processed?",
    "What configuration options are available?"
  ];
  
  console.log('\n🌐 Testing generic questions:');
  for (const question of genericQuestions) {
    console.log(`\n🔍 Testing: "${question}"`);
    const intent = detectQueryIntent(question, extractKeywords(question));
    console.log(`🎯 Detected intent: ${intent}`);
    
    const results = searchKnowledge(question);
    console.log(`📊 Found ${results.length} results`);
    
    if (results.length > 0) {
      console.log(`🏆 Top result: ${results[0].filePath}`);
    }
  }
  
  // Test codebase detection
  console.log('\n🏗️ Testing codebase detection:');
  const codebaseType = detectCodebaseType(knowledgeBase);
  console.log(`📊 Detected codebase type: ${codebaseType}`);
  console.log(`📊 Knowledge base size: ${knowledgeBase.length} entries`);
  
  // Test content extraction
  console.log('\n📝 Testing content extraction:');
  const sampleEntry = knowledgeBase.find(entry => entry.content.includes('portal') || entry.content.includes('settings'));
  if (sampleEntry) {
    console.log(`🔍 Sample entry: ${sampleEntry.filePath}`);
    const textBlocks = extractCompleteTextContent(sampleEntry.content, sampleEntry.filePath);
    console.log(`📝 Extracted ${textBlocks.length} text blocks`);
    textBlocks.slice(0, 3).forEach((text, index) => {
      console.log(`  ${index + 1}. "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    });
  }
  
  console.log('\n✅ Ghost and universality test completed!');
}

/**
 * Universal business intent detection for customer questions
 */
function detectBusinessIntent(originalQuestion: string, keywords: string[]): 'capability' | 'coverage' | 'process' | 'pricing' | 'integration' | 'constraint' | 'general' {
  const lowerQuestion = originalQuestion.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  console.log(`💼 Analyzing business intent for: "${originalQuestion}"`);
  console.log(`🔑 Keywords: ${keywords.join(', ')}`);
  
  // Capability questions ("Do we support X?", "Can we do Y?")
  const capabilityKeywords = ['do we', 'can we', 'support', 'offer', 'provide', 'include', 'have', 'does', 'capable', 'available', 'feature'];
  const capabilityMatches = capabilityKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (capabilityMatches.length > 0) {
    console.log(`✨ Detected Capability intent: ${capabilityMatches.join(', ')}`);
    return 'capability';
  }
  
  // Coverage questions (geographic, platform, market)
  const coverageKeywords = ['country', 'region', 'state', 'city', 'location', 'platform', 'market', 'segment', 'area', 'territory', 'jurisdiction'];
  const coverageMatches = coverageKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (coverageMatches.length > 0) {
    console.log(`🌍 Detected Coverage intent: ${coverageMatches.join(', ')}`);
    return 'coverage';
  }
  
  // Process questions ("How does it work?", "What's the process?")
  const processKeywords = ['how', 'process', 'workflow', 'step', 'procedure', 'work', 'flow', 'timeline', 'duration', 'setup', 'onboarding'];
  const processMatches = processKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (processMatches.length > 0) {
    console.log(`🔄 Detected Process intent: ${processMatches.join(', ')}`);
    return 'process';
  }
  
  // Pricing questions
  const pricingKeywords = ['cost', 'price', 'fee', 'charge', 'pricing', 'expensive', 'cheap', 'affordable', 'rate', 'amount', 'dollar', 'euro', 'currency', 'tier', 'package'];
  const pricingMatches = pricingKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (pricingMatches.length > 0) {
    console.log(`💰 Detected Pricing intent: ${pricingMatches.join(', ')}`);
    return 'pricing';
  }
  
  // Integration questions
  const integrationKeywords = ['integration', 'api', 'connect', 'webhook', 'endpoint', 'sdk', 'plugin', 'connector', 'sync', 'data', 'third-party'];
  const integrationMatches = integrationKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (integrationMatches.length > 0) {
    console.log(`🔗 Detected Integration intent: ${integrationMatches.join(', ')}`);
    return 'integration';
  }
  
  // Constraint questions (limits, restrictions, requirements)
  const constraintKeywords = ['limit', 'restriction', 'constraint', 'maximum', 'minimum', 'only', 'exclude', 'not support', 'cannot', 'must'];
  const constraintMatches = constraintKeywords.filter(keyword => 
    lowerQuestion.includes(keyword) || lowerKeywords.some(k => k.includes(keyword))
  );
  
  if (constraintMatches.length > 0) {
    console.log(`🚫 Detected Constraint intent: ${constraintMatches.join(', ')}`);
    return 'constraint';
  }
  
  console.log(`🔍 Detected General intent - no specific business patterns matched`);
  return 'general';
}

/**
 * Universal business logic extraction from any codebase
 */
function extractUniversalBusinessLogic(content: string, filePath: string): string[] {
  console.log(`🔍 Extracting business logic from ${filePath} (${content.length} characters)`);
  
  const businessLogic: string[] = [];
  
  // Check if this is actual file content or placeholder text
  const isActualContent = content.length > 100 && !content.includes('CMS Config:') && !content.includes('Content Count:');
  
  if (!isActualContent) {
    console.log(`⚠️  Skipping placeholder content for ${filePath}`);
    return businessLogic;
  }
  
  console.log(`✅ Processing actual file content for ${filePath}`);
  
  // Extract configuration objects that define business rules
  const configMatches = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*{([^}]+)}/g);
  if (configMatches) {
    configMatches.forEach(match => {
      const lowerMatch = match.toLowerCase();
      if (lowerMatch.includes('config') || 
          lowerMatch.includes('settings') || 
          lowerMatch.includes('feature') ||
          lowerMatch.includes('service') ||
          lowerMatch.includes('product') ||
          lowerMatch.includes('capability') ||
          lowerMatch.includes('support') ||
          lowerMatch.includes('enable') ||
          lowerMatch.includes('available')) {
        businessLogic.push(`Configuration: ${match}`);
        console.log(`⚙️  Found configuration: ${match.substring(0, 50)}...`);
      }
    });
  }
  
  // Extract feature flags and capability switches
  const featureMatches = content.match(/(?:feature|capability|support|enable|available)\s*[:=]\s*(true|false|enabled|disabled|on|off)/gi);
  if (featureMatches) {
    featureMatches.forEach(match => {
      businessLogic.push(`Feature Flag: ${match}`);
      console.log(`🚩 Found feature flag: ${match}`);
    });
  }
  
  // Extract geographic data
  const geoMatches = content.match(/(?:countries|regions|states|cities|locations|markets|territories)\s*[:=]\s*\[([^\]]+)\]/gi);
  if (geoMatches) {
    geoMatches.forEach(match => {
      businessLogic.push(`Geographic Coverage: ${match}`);
      console.log(`🌍 Found geographic data: ${match}`);
    });
  }
  
  // Extract pricing and tier information
  const pricingMatches = content.match(/(?:price|cost|fee|rate|tier|package|plan)\s*[:=]\s*([^,\n]+)/gi);
  if (pricingMatches) {
    pricingMatches.forEach(match => {
      businessLogic.push(`Pricing: ${match}`);
      console.log(`💰 Found pricing: ${match}`);
    });
  }
  
  // Extract service types and product offerings
  const serviceMatches = content.match(/(?:service|product|offering|module|type)\s*[:=]\s*([^,\n]+)/gi);
  if (serviceMatches) {
    serviceMatches.forEach(match => {
      businessLogic.push(`Service Type: ${match}`);
      console.log(`🔧 Found service: ${match}`);
    });
  }
  
  // Extract integrations and third-party services
  const integrationMatches = content.match(/(?:integration|api|webhook|connector|plugin|sdk)\s*[:=]\s*([^,\n]+)/gi);
  if (integrationMatches) {
    integrationMatches.forEach(match => {
      businessLogic.push(`Integration: ${match}`);
      console.log(`🔗 Found integration: ${match}`);
    });
  }
  
  // Extract process workflows and procedures
  const processMatches = content.match(/(?:process|workflow|procedure|step|flow|timeline)\s*[:=]\s*([^,\n]+)/gi);
  if (processMatches) {
    processMatches.forEach(match => {
      businessLogic.push(`Process: ${match}`);
      console.log(`🔄 Found process: ${match}`);
    });
  }
  
  // Extract constraints and limitations
  const constraintMatches = content.match(/(?:limit|restriction|constraint)\s*[:=]\s*([^,\n]+)/gi) || [];
  if (constraintMatches) {
    constraintMatches.forEach(match => {
      businessLogic.push(`Constraint: ${match}`);
      console.log(`🚫 Found constraint: ${match}`);
    });
  }
  
  // Extract customer types and market segments
  const customerMatches = content.match(/(?:customer|user|client|segment)\s*[:=]\s*([^,\n]+)/gi) || [];
  if (customerMatches) {
    customerMatches.forEach(match => {
      businessLogic.push(`Customer Type: ${match}`);
      console.log(`👥 Found customer type: ${match}`);
    });
  }
  
  console.log(`✅ Business logic extraction complete for ${filePath}: ${businessLogic.length} items found`);
  
  return businessLogic;
}

/**
 * Learn domain vocabulary from the codebase
 */
function learnDomainVocabulary(knowledgeBase: KnowledgeEntry[]): void {
  console.log('🧠 Learning domain vocabulary from codebase...');
  
  const allContent = knowledgeBase.map(entry => entry.content).join(' ');
  
  // Extract capitalized terms (likely product/service names)
  const capitalizedTerms = allContent.match(/\b[A-Z][a-z]+[A-Z][a-z]*\b/g) || [];
  businessDomain.productTerms = [...new Set(capitalizedTerms)].slice(0, 20);
  
  // Extract service types from configuration patterns
  const servicePatterns = allContent.match(/(?:service|product|offering|module)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.serviceTypes = servicePatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract geographic data
  const geoPatterns = allContent.match(/(?:countries|regions|states|cities)\s*[:=]\s*\[([^\]]+)\]/gi) || [];
  businessDomain.geographicData = geoPatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract pricing models
  const pricingPatterns = allContent.match(/(?:price|cost|fee|rate|tier)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.pricingModels = pricingPatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract feature categories
  const featurePatterns = allContent.match(/(?:feature|capability|support)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.featureCategories = featurePatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract process flows
  const processPatterns = allContent.match(/(?:process|workflow|procedure)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.processFlows = processPatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract constraints
  const constraintPatterns = allContent.match(/(?:limit|restriction|constraint)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.constraints = constraintPatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract integrations
  const integrationPatterns = allContent.match(/(?:integration|api|webhook)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.integrations = integrationPatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract customer types
  const customerPatterns = allContent.match(/(?:customer|user|client|segment)\s*[:=]\s*([^,\n]+)/gi) || [];
  businessDomain.customerTypes = customerPatterns.map(match => match.split(/[:=]/)[1]?.trim()).filter(Boolean).slice(0, 10);
  
  // Extract industry-specific terms
  const industryTerms = allContent.match(/\b[a-z]+(?:\s+[a-z]+)*\b/gi) || [];
  const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall']);
  businessDomain.industryTerms = industryTerms
    .filter(term => term.length > 3 && !commonWords.has(term.toLowerCase()))
    .slice(0, 30);
  
  console.log('✅ Domain vocabulary learned:');
  console.log(`   - Product terms: ${businessDomain.productTerms.slice(0, 5).join(', ')}...`);
  console.log(`   - Service types: ${businessDomain.serviceTypes.slice(0, 5).join(', ')}...`);
  console.log(`   - Geographic data: ${businessDomain.geographicData.slice(0, 5).join(', ')}...`);
  console.log(`   - Industry terms: ${businessDomain.industryTerms.slice(0, 5).join(', ')}...`);
}

/**
 * Universal business-focused file relevance scoring
 */
function getBusinessFileRelevance(filePath: string, fileName: string, content: string, intent: string): number {
  const lowerPath = filePath.toLowerCase();
  const lowerName = fileName.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Configuration and documentation files are highly relevant
  if (lowerName.includes('config') || lowerName.includes('settings') || lowerName.includes('readme') || lowerName.includes('docs')) {
    return 0.9;
  }
  
  // API and integration files
  if (lowerPath.includes('api') || lowerPath.includes('integration') || lowerPath.includes('webhook')) {
    return 0.8;
  }
  
  // Business logic and service files
  if (lowerPath.includes('business') || lowerPath.includes('logic') || lowerPath.includes('service')) {
    return 0.8;
  }
  
  // Feature and capability files
  if (lowerPath.includes('feature') || lowerPath.includes('capability') || lowerPath.includes('product')) {
    return 0.8;
  }
  
  // Geographic and coverage files
  if (lowerPath.includes('country') || lowerPath.includes('region') || lowerPath.includes('geo') || lowerPath.includes('market')) {
    return 0.8;
  }
  
  // Pricing and billing files
  if (lowerPath.includes('pricing') || lowerPath.includes('billing') || lowerPath.includes('cost') || lowerPath.includes('tier')) {
    return 0.8;
  }
  
  // Content relevance based on intent and domain vocabulary
  const domainTerms = [
    ...businessDomain.productTerms,
    ...businessDomain.serviceTypes,
    ...businessDomain.featureCategories,
    ...businessDomain.industryTerms
  ];
  
  const hasDomainTerms = domainTerms.some(term => 
    lowerContent.includes(term.toLowerCase())
  );
  
  if (hasDomainTerms) {
    return 0.7;
  }
  
  // Intent-specific relevance
  switch (intent) {
    case 'capability':
      if (lowerContent.includes('feature') || lowerContent.includes('capability') || lowerContent.includes('support')) {
        return 0.6;
      }
      break;
    case 'coverage':
      if (lowerContent.includes('country') || lowerContent.includes('region') || lowerContent.includes('market')) {
        return 0.6;
      }
      break;
    case 'process':
      if (lowerContent.includes('process') || lowerContent.includes('workflow') || lowerContent.includes('step')) {
        return 0.6;
      }
      break;
    case 'pricing':
      if (lowerContent.includes('price') || lowerContent.includes('cost') || lowerContent.includes('fee')) {
        return 0.6;
      }
      break;
    case 'integration':
      if (lowerContent.includes('integration') || lowerContent.includes('api') || lowerContent.includes('webhook')) {
        return 0.6;
      }
      break;
    case 'constraint':
      if (lowerContent.includes('limit') || lowerContent.includes('restriction') || lowerContent.includes('constraint')) {
        return 0.6;
      }
      break;
  }
  
  return 0.3; // Default relevance
}

/**
 * Specialized business search for customer-facing teams
 */
export async function searchBusinessKnowledge(
  originalQuestion: string,
  keywords: string[],
  knowledgeBase: KnowledgeEntry[]
): Promise<SearchResult[]> {
  console.log('💼 Starting specialized business knowledge search...');
  
  // Learn domain vocabulary if not already done
  if (businessDomain.productTerms.length === 0) {
    learnDomainVocabulary(knowledgeBase);
  }
  
  // Detect business intent
  const intent = detectBusinessIntent(originalQuestion, keywords);
  
  // Extract business logic from all files
  const businessResults: SearchResult[] = [];
  
  for (const entry of knowledgeBase) {
    // Extract fileName from filePath
    const fileName = entry.filePath.split('/').pop() || entry.filePath;
    
    // Get business-focused relevance score
    const relevance = getBusinessFileRelevance(entry.filePath, fileName, entry.content, intent);
    
    if (relevance > 0.3) {
      // Extract business logic from this file
      const businessLogic = extractUniversalBusinessLogic(entry.content, entry.filePath);
      
      if (businessLogic.length > 0) {
        // Calculate keyword matches for business logic
        const keywordMatches = keywords.filter(keyword => 
          businessLogic.some(logic => logic.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        // Calculate content relevance for business logic
        const contentRelevance = keywordMatches.length / keywords.length;
        
        // Combine relevance scores
        const finalScore = (relevance * 0.6) + (contentRelevance * 0.4);
        
        businessResults.push({
          filePath: entry.filePath,
          fileName: fileName,
          content: businessLogic.join('\n\n'),
          score: finalScore,
          relevance: finalScore,
          keywordMatches: keywordMatches,
          businessLogic: businessLogic,
          intent: intent
        });
      }
    }
  }
  
  // Sort by relevance and return top results
  const sortedResults = businessResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  console.log(`✅ Business search found ${sortedResults.length} relevant results for ${intent} intent`);
  
  return sortedResults;
}

/**
 * Enhanced search function with business logic prioritization
 */
export async function searchKnowledgeEnhanced(
  originalQuestion: string,
  keywords: string[],
  knowledgeBase: KnowledgeEntry[]
): Promise<SearchResult[]> {
  console.log('🔍 Starting enhanced knowledge search with business logic...');
  
  // First, try specialized business search for customer-facing questions
  const businessResults = await searchBusinessKnowledge(originalQuestion, keywords, knowledgeBase);
  
  // If we found good business results, prioritize them
  if (businessResults.length > 0 && businessResults[0].score > 0.5) {
    console.log('💼 Using business-focused results for customer question');
    return businessResults;
  }
  
  // Fall back to regular search for technical questions
  console.log('🔧 Falling back to regular technical search');
  
  const results: SearchResult[] = [];
  
  for (const entry of knowledgeBase) {
    const lowerContent = entry.content.toLowerCase();
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    
    // Calculate keyword matches
    const keywordMatches = lowerKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    );
    
    if (keywordMatches.length > 0) {
      const relevance = keywordMatches.length / keywords.length;
      
      results.push({
        filePath: entry.filePath,
        fileName: entry.filePath.split('/').pop() || entry.filePath,
        content: entry.content,
        score: relevance,
        relevance: relevance,
        keywordMatches: keywordMatches,
        intent: 'general'
      });
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Test the business logic extraction system
 */
export async function testBusinessLogicExtraction(): Promise<void> {
  console.log('🧪 Testing business logic extraction system...');
  
  // Test business intent detection
  const testQuestions = [
    'Do we support payment processing in Canada?',
    'What is the pricing for enterprise plans?',
    'How does the onboarding process work?',
    'Can we integrate with Salesforce?',
    'What are the file size limits?',
    'Which countries do we operate in?'
  ];
  
  console.log('\n📋 Testing business intent detection:');
  testQuestions.forEach(question => {
    const keywords = extractKeywords(question);
    const intent = detectBusinessIntent(question, keywords);
    console.log(`   "${question}" -> ${intent} intent`);
  });
  
  // Test business logic extraction
  const testContent = `
    const config = {
      features: {
        paymentProcessing: true,
        analytics: false,
        integrations: ['stripe', 'paypal']
      },
      pricing: {
        basic: 29,
        pro: 99,
        enterprise: 299
      },
      countries: ['US', 'CA', 'UK', 'AU'],
      limits: {
        fileSize: '100MB',
        users: 1000
      }
    };
  `;
  
  console.log('\n🔍 Testing business logic extraction:');
  const businessLogic = extractUniversalBusinessLogic(testContent, 'test-config.js');
  businessLogic.forEach(logic => {
    console.log(`   ${logic}`);
  });
  
  // Test domain vocabulary learning
  console.log('\n🧠 Testing domain vocabulary learning:');
  const mockEntries: KnowledgeEntry[] = [
    {
      filePath: 'config/features.js',
      content: testContent,
      keywords: ['config', 'features', 'pricing'],
      type: 'config'
    }
  ];
  
  learnDomainVocabulary(mockEntries);
  console.log(`   Product terms: ${businessDomain.productTerms.slice(0, 3).join(', ')}`);
  console.log(`   Service types: ${businessDomain.serviceTypes.slice(0, 3).join(', ')}`);
  console.log(`   Geographic data: ${businessDomain.geographicData.slice(0, 3).join(', ')}`);
  
  console.log('\n✅ Business logic extraction test completed!');
}

/**
 * Enhanced business question routing and response system
 */
interface BusinessQuestionRoute {
  intent: 'capability' | 'coverage' | 'process' | 'pricing' | 'integration' | 'constraint' | 'general';
  targetFiles: string[];
  contentTypes: string[];
  responseFormat: 'yes_no' | 'list' | 'step_by_step' | 'detailed' | 'structured';
  confidenceFactors: string[];
}

/**
 * Business response structure for customer-facing teams
 */
interface BusinessResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  scope: string[];
  limitations: string[];
  sourceFiles: string[];
  responseType: 'capability' | 'coverage' | 'process' | 'pricing' | 'integration' | 'constraint' | 'general';
}

/**
 * Enhanced business intent detection with routing
 */
function getBusinessQuestionRoute(originalQuestion: string, keywords: string[]): BusinessQuestionRoute {
  const intent = detectBusinessIntent(originalQuestion, keywords);
  const lowerQuestion = originalQuestion.toLowerCase();
  
  // Define routing rules for each intent type
  const routes: Record<string, BusinessQuestionRoute> = {
    capability: {
      intent: 'capability',
      targetFiles: ['config', 'features', 'capabilities', 'services', 'product', 'offering'],
      contentTypes: ['feature lists', 'service definitions', 'product catalogs', 'capability matrices'],
      responseFormat: 'yes_no',
      confidenceFactors: ['boolean flags', 'feature toggles', 'enabled states', 'supported lists']
    },
    coverage: {
      intent: 'coverage',
      targetFiles: ['geo', 'region', 'country', 'market', 'territory', 'location'],
      contentTypes: ['geographic data', 'regional configs', 'market boundaries', 'coverage maps'],
      responseFormat: 'list',
      confidenceFactors: ['country lists', 'region definitions', 'market segments', 'territory maps']
    },
    process: {
      intent: 'process',
      targetFiles: ['workflow', 'process', 'guide', 'docs', 'integration', 'setup'],
      contentTypes: ['documentation', 'guides', 'workflow definitions', 'step-by-step processes'],
      responseFormat: 'step_by_step',
      confidenceFactors: ['workflow steps', 'process flows', 'integration guides', 'setup procedures']
    },
    pricing: {
      intent: 'pricing',
      targetFiles: ['pricing', 'billing', 'cost', 'tier', 'plan', 'package'],
      contentTypes: ['billing logic', 'pricing tiers', 'cost structures', 'plan definitions'],
      responseFormat: 'structured',
      confidenceFactors: ['pricing configs', 'tier definitions', 'cost calculations', 'billing rules']
    },
    integration: {
      intent: 'integration',
      targetFiles: ['api', 'webhook', 'integration', 'connector', 'sdk', 'plugin'],
      contentTypes: ['API definitions', 'webhook handlers', 'third-party configs', 'integration guides'],
      responseFormat: 'detailed',
      confidenceFactors: ['API endpoints', 'webhook configs', 'integration status', 'third-party lists']
    },
    constraint: {
      intent: 'constraint',
      targetFiles: ['limit', 'constraint', 'validation', 'boundary', 'restriction'],
      contentTypes: ['constraint configs', 'validation rules', 'boundary definitions', 'limit structures'],
      responseFormat: 'structured',
      confidenceFactors: ['limit definitions', 'constraint rules', 'validation logic', 'boundary configs']
    }
  };
  
  return routes[intent] || routes.general;
}

/**
 * Enhanced content extraction for business answers
 */
function extractBusinessContent(content: string, filePath: string, route: BusinessQuestionRoute): {
  businessLogic: string[];
  structuredData: Record<string, unknown>[];
  userFacingContent: string[];
  confidence: number;
} {
  const businessLogic: string[] = [];
  const structuredData: Record<string, unknown>[] = [];
  const userFacingContent: string[] = [];
  let confidence = 0;
  
  // Extract complete business logic blocks based on route
  switch (route.intent) {
    case 'capability': {
      // Look for feature flags, capability switches, supported lists
      const capabilityPatterns = [
        /(?:feature|capability|support|enable|available)\s*[:=]\s*(true|false|enabled|disabled|on|off)/gi,
        /(?:supported|available|included)\s*[:=]\s*\[([^\]]+)\]/gi,
        /(?:features|capabilities|services)\s*[:=]\s*\{([^}]+)\}/gi
      ];
      
      capabilityPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            businessLogic.push(`Capability: ${match}`);
            confidence += 0.3;
          });
        }
      });
      break;
    }
      
    case 'coverage': {
      // Look for geographic data, regional configs, market definitions
      const coveragePatterns = [
        /(?:countries|regions|states|cities|markets|territories)\s*[:=]\s*\[([^\]]+)\]/gi,
        /(?:geo|location|area)\s*[:=]\s*\{([^}]+)\}/gi,
        /(?:supported|available|operating)\s+(?:in|for)\s*[:=]\s*([^,\n]+)/gi
      ];
      
      coveragePatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            businessLogic.push(`Coverage: ${match}`);
            confidence += 0.3;
          });
        }
      });
      break;
    }
      
    case 'process': {
      // Look for workflow definitions, step-by-step processes, guides
      const processPatterns = [
        /(?:workflow|process|procedure|steps?)\s*[:=]\s*\[([^\]]+)\]/gi,
        /(?:step|stage|phase)\s*\d+\s*[:=]\s*([^,\n]+)/gi,
        /(?:guide|documentation|instructions?)\s*[:=]\s*([^,\n]+)/gi
      ];
      
      processPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            businessLogic.push(`Process: ${match}`);
            confidence += 0.3;
          });
        }
      });
      break;
    }
      
    case 'pricing': {
      // Look for pricing structures, billing logic, cost calculations
      const pricingPatterns = [
        /(?:price|cost|fee|rate|tier|plan)\s*[:=]\s*([^,\n]+)/gi,
        /(?:pricing|billing)\s*[:=]\s*\{([^}]+)\}/gi,
        /(?:currency|amount|dollar|euro)\s*[:=]\s*([^,\n]+)/gi
      ];
      
      pricingPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            businessLogic.push(`Pricing: ${match}`);
            confidence += 0.3;
          });
        }
      });
      break;
    }
      
    case 'integration': {
      // Look for API definitions, webhook configs, third-party integrations
      const integrationPatterns = [
        /(?:api|webhook|integration|connector)\s*[:=]\s*([^,\n]+)/gi,
        /(?:endpoint|url|hook)\s*[:=]\s*([^,\n]+)/gi,
        /(?:third-party|external|partner)\s*[:=]\s*\[([^\]]+)\]/gi
      ];
      
      integrationPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            businessLogic.push(`Integration: ${match}`);
            confidence += 0.3;
          });
        }
      });
      break;
    }
      
    case 'constraint': {
      // Look for limit definitions, validation rules, boundary configs
      const constraintPatterns = [
        /(?:limit|constraint|maximum|minimum)\s*[:=]\s*([^,\n]+)/gi,
        /(?:validation|rule|boundary)\s*[:=]\s*([^,\n]+)/gi,
        /(?:restriction|requirement|must|only)\s*[:=]\s*([^,\n]+)/gi
      ];
      
      constraintPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            businessLogic.push(`Constraint: ${match}`);
            confidence += 0.3;
          });
        }
      });
      break;
    }
  }
  
  // Extract structured data (JSON, YAML, config objects)
  const jsonMatches = content.match(/\{[^{}]*\}/g);
  if (jsonMatches) {
    jsonMatches.forEach(match => {
      try {
        const parsed = JSON.parse(match);
        structuredData.push(parsed);
        confidence += 0.2;
      } catch (e) {
        // Not valid JSON, but might be config-like
        if (match.includes(':') && match.includes('{')) {
          structuredData.push({ raw: match });
          confidence += 0.1;
        }
      }
    });
  }
  
  // Extract user-facing content (comments, descriptions, documentation)
  const commentMatches = content.match(/\/\*\*?([^*]+)\*\//g);
  const descriptionMatches = content.match(/\/\/\s*([^\n]+)/g);
  const stringMatches = content.match(/"([^"]{10,})"/g);
  
  if (commentMatches) {
    userFacingContent.push(...commentMatches.map(m => m.replace(/\/\*\*?|\*\//g, '').trim()));
    confidence += 0.1;
  }
  if (descriptionMatches) {
    userFacingContent.push(...descriptionMatches.map(m => m.replace(/\/\/\s*/, '').trim()));
    confidence += 0.1;
  }
  if (stringMatches) {
    userFacingContent.push(...stringMatches.map(m => m.replace(/"/g, '')));
    confidence += 0.1;
  }
  
  return {
    businessLogic,
    structuredData,
    userFacingContent,
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Enhanced yes/no capability question handling
 */
function analyzeCapabilityQuestion(content: string, keywords: string[]): {
  answer: 'yes' | 'no' | 'partial' | 'unknown';
  confidence: number;
  evidence: string[];
  scope: string[];
} {
  const lowerContent = content.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  let answer: 'yes' | 'no' | 'partial' | 'unknown' = 'unknown';
  let confidence = 0;
  const evidence: string[] = [];
  const scope: string[] = [];
  
  // Look for boolean flags and feature toggles
  const booleanPatterns = [
    /(?:feature|capability|support|enable|available)\s*[:=]\s*(true|enabled|on)/gi,
    /(?:feature|capability|support|enable|available)\s*[:=]\s*(false|disabled|off)/gi
  ];
  
  const positiveMatches = content.match(booleanPatterns[0]);
  const negativeMatches = content.match(booleanPatterns[1]);
  
  if (positiveMatches && positiveMatches.length > negativeMatches?.length) {
    answer = 'yes';
    confidence += 0.4;
    evidence.push(`Found ${positiveMatches.length} positive capability flags`);
  } else if (negativeMatches && negativeMatches.length > positiveMatches?.length) {
    answer = 'no';
    confidence += 0.4;
    evidence.push(`Found ${negativeMatches.length} negative capability flags`);
  }
  
  // Look for presence in supported lists
  const listPatterns = [
    /(?:supported|available|included)\s*[:=]\s*\[([^\]]+)\]/gi,
    /(?:features|capabilities|services)\s*[:=]\s*\[([^\]]+)\]/gi
  ];
  
  listPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const listContent = match.match(/\[([^\]]+)\]/)?.[1] || '';
        const hasKeyword = lowerKeywords.some(keyword => 
          listContent.toLowerCase().includes(keyword)
        );
        
        if (hasKeyword) {
          answer = 'yes';
          confidence += 0.3;
          evidence.push(`Found in supported list: ${match}`);
          scope.push(listContent);
        }
      });
    }
  });
  
  // Look for constraint definitions that might indicate limitations
  const constraintPatterns = [
    /(?:not\s+supported|not\s+available|excluded|disabled)\s*[:=]\s*([^,\n]+)/gi,
    /(?:limit|restriction|constraint)\s*[:=]\s*([^,\n]+)/gi
  ];
  
  constraintPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const hasKeyword = lowerKeywords.some(keyword => 
          match.toLowerCase().includes(keyword)
        );
        
        if (hasKeyword) {
          answer = 'no';
          confidence += 0.3;
          evidence.push(`Found constraint: ${match}`);
        }
      });
    }
  });
  
  return { answer, confidence: Math.min(confidence, 1.0), evidence, scope };
}

/**
 * Generate domain-specific business responses
 */
function generateBusinessResponse(
  question: string,
  route: BusinessQuestionRoute,
  extractedContent: {
    businessLogic: string[];
    structuredData: Record<string, unknown>[];
    userFacingContent: string[];
  },
  searchResults: SearchResult[]
): BusinessResponse {
  const response: BusinessResponse = {
    answer: '',
    confidence: 'low',
    evidence: [],
    scope: [],
    limitations: [],
    sourceFiles: searchResults.map(r => r.filePath),
    responseType: route.intent
  };
  
  // Generate response based on route type
  switch (route.intent) {
    case 'capability': {
      const capabilityAnalysis = analyzeCapabilityQuestion(
        searchResults.map(r => r.content).join('\n'),
        extractKeywords(question)
      );
      
      response.answer = capabilityAnalysis.answer === 'yes' 
        ? `Yes, we support ${extractKeywords(question).join(' ')}.`
        : capabilityAnalysis.answer === 'no'
        ? `No, we do not currently support ${extractKeywords(question).join(' ')}.`
        : `We have partial support for ${extractKeywords(question).join(' ')}.`;
      
      response.confidence = capabilityAnalysis.confidence > 0.7 ? 'high' : 
                           capabilityAnalysis.confidence > 0.4 ? 'medium' : 'low';
      response.evidence = capabilityAnalysis.evidence;
      response.scope = capabilityAnalysis.scope;
      break;
    }
      
    case 'coverage': {
      const coverageData = extractedContent.businessLogic.filter((logic: string) => 
        logic.toLowerCase().includes('coverage') || 
        logic.toLowerCase().includes('country') ||
        logic.toLowerCase().includes('region')
      );
      
      response.answer = `We operate in the following regions: ${coverageData.map((c: string) => 
        c.replace(/Coverage:\s*/, '')
      ).join(', ')}`;
      response.confidence = coverageData.length > 0 ? 'high' : 'low';
      response.evidence = coverageData;
      break;
    }
      
    case 'process': {
      const processSteps = extractedContent.businessLogic.filter((logic: string) => 
        logic.toLowerCase().includes('process') || 
        logic.toLowerCase().includes('workflow') ||
        logic.toLowerCase().includes('step')
      );
      
      response.answer = `The process involves: ${processSteps.map((p: string) => 
        p.replace(/Process:\s*/, '')
      ).join(' → ')}`;
      response.confidence = processSteps.length > 0 ? 'high' : 'low';
      response.evidence = processSteps;
      break;
    }
      
    case 'pricing': {
      const pricingData = extractedContent.businessLogic.filter((logic: string) => 
        logic.toLowerCase().includes('pricing') || 
        logic.toLowerCase().includes('price') ||
        logic.toLowerCase().includes('cost')
      );
      
      response.answer = `Pricing information: ${pricingData.map((p: string) => 
        p.replace(/Pricing:\s*/, '')
      ).join(', ')}`;
      response.confidence = pricingData.length > 0 ? 'high' : 'low';
      response.evidence = pricingData;
      break;
    }
      
    case 'integration': {
      const integrationData = extractedContent.businessLogic.filter((logic: string) => 
        logic.toLowerCase().includes('integration') || 
        logic.toLowerCase().includes('api') ||
        logic.toLowerCase().includes('webhook')
      );
      
      response.answer = `Integration capabilities: ${integrationData.map((i: string) => 
        i.replace(/Integration:\s*/, '')
      ).join(', ')}`;
      response.confidence = integrationData.length > 0 ? 'high' : 'low';
      response.evidence = integrationData;
      break;
    }
      
    case 'constraint': {
      const constraintData = extractedContent.businessLogic.filter((logic: string) => 
        logic.toLowerCase().includes('constraint') || 
        logic.toLowerCase().includes('limit') ||
        logic.toLowerCase().includes('restriction')
      );
      
      response.answer = `Limitations and constraints: ${constraintData.map((c: string) => 
        c.replace(/Constraint:\s*/, '')
      ).join(', ')}`;
      response.confidence = constraintData.length > 0 ? 'high' : 'low';
      response.evidence = constraintData;
      break;
    }
  }
  
  // Add confidence indicators
  if (response.confidence === 'low') {
    response.answer += ' (Note: This information may be incomplete)';
  }
  
  return response;
}

/**
 * Enhanced business search with intelligent routing and response generation
 */
export async function searchBusinessKnowledgeEnhanced(
  originalQuestion: string,
  keywords: string[],
  knowledgeBase: KnowledgeEntry[]
): Promise<{
  searchResults: SearchResult[];
  businessResponse: BusinessResponse;
  route: BusinessQuestionRoute;
}> {
  console.log('💼 Starting enhanced business knowledge search with intelligent routing...');
  
  // Get business question route
  const route = getBusinessQuestionRoute(originalQuestion, keywords);
  console.log(`🎯 Routing to: ${route.intent} (${route.responseFormat} format)`);
  
  // Special handling for integration questions
  if (route.intent === 'integration') {
    console.log('🔗 Detected integration question - using enhanced integration routing');
    const integrationRoute = getIntegrationQuestionRoute(originalQuestion, keywords);
    
    // Analyze integration patterns in the codebase
    const integrationAnalysis = analyzeIntegrationPatterns(knowledgeBase);
    console.log(`🔍 Found ${integrationAnalysis.services.length} services: ${integrationAnalysis.services.slice(0, 5).join(', ')}...`);
    console.log(`🔍 Found ${integrationAnalysis.patterns.length} integration patterns: ${integrationAnalysis.patterns.slice(0, 3).join(', ')}...`);
    
    // Extract business logic from all files with integration-specific targeting
    const businessResults: SearchResult[] = [];
    const allExtractedContent = {
      businessLogic: [] as string[],
      structuredData: [] as Record<string, unknown>[],
      userFacingContent: [] as string[]
    };
    
    for (const entry of knowledgeBase) {
      const fileName = entry.filePath.split('/').pop() || entry.filePath;
      
      // Use integration-specific file relevance scoring
      const integrationRelevance = getIntegrationFileRelevance(entry.filePath, fileName, entry.content);
      
      if (integrationRelevance > 0.2) {
        // Extract integration-specific content
        const extractedIntegrationContent = extractIntegrationContent(entry.content, entry.filePath);
        
        if (extractedIntegrationContent.services.length > 0 || 
            extractedIntegrationContent.integrations.length > 0 ||
            extractedIntegrationContent.webhooks.length > 0 ||
            extractedIntegrationContent.apis.length > 0) {
          
          // Calculate keyword matches for integration content
          const keywordMatches = keywords.filter(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            return extractedIntegrationContent.services.some(service => service.toLowerCase().includes(lowerKeyword)) ||
                   extractedIntegrationContent.integrations.some(integration => integration.toLowerCase().includes(lowerKeyword)) ||
                   extractedIntegrationContent.webhooks.some(webhook => webhook.toLowerCase().includes(lowerKeyword)) ||
                   extractedIntegrationContent.apis.some(api => api.toLowerCase().includes(lowerKeyword));
          });
          
          // Calculate content relevance for integration content
          const contentRelevance = keywordMatches.length / keywords.length;
          
          // Higher score for integration-relevant files
          const finalScore = (integrationRelevance * 0.6) + (contentRelevance * 0.4) + (extractedIntegrationContent.confidence * 0.3);
          
          // Create business logic summary for integration
          const integrationSummary = [
            ...extractedIntegrationContent.services.map(s => `Service: ${s}`),
            ...extractedIntegrationContent.integrations.map(i => `Integration: ${i}`),
            ...extractedIntegrationContent.webhooks.map(w => `Webhook: ${w}`),
            ...extractedIntegrationContent.apis.map(a => `API: ${a}`),
            ...extractedIntegrationContent.configs.map(c => `Config: ${c}`)
          ];
          
          businessResults.push({
            filePath: entry.filePath,
            fileName: fileName,
            content: integrationSummary.join('\n\n'),
            score: finalScore,
            relevance: finalScore,
            keywordMatches: keywordMatches,
            businessLogic: integrationSummary,
            intent: 'integration'
          });
          
          // Accumulate all extracted content
          allExtractedContent.businessLogic.push(...integrationSummary);
          allExtractedContent.structuredData.push(...extractedIntegrationContent.configs.map(c => ({ config: c })));
          allExtractedContent.userFacingContent.push(...extractedIntegrationContent.documentation);
        }
      }
    }
    
    // Sort by relevance and get top results
    const sortedResults = businessResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    // Generate business response
    const businessResponse = generateBusinessResponse(
      originalQuestion,
      integrationRoute,
      allExtractedContent,
      sortedResults
    );
    
    console.log(`✅ Enhanced integration search found ${sortedResults.length} results`);
    console.log(`💬 Generated response: ${businessResponse.answer.substring(0, 100)}...`);
    console.log(`🎯 Confidence: ${businessResponse.confidence}`);
    
    return {
      searchResults: sortedResults,
      businessResponse,
      route: integrationRoute
    };
  }
  
  // Learn domain vocabulary if not already done
  if (businessDomain.productTerms.length === 0) {
    learnDomainVocabulary(knowledgeBase);
  }
  
  // Extract business logic from all files with route-specific targeting
  const businessResults: SearchResult[] = [];
  const allExtractedContent = {
    businessLogic: [] as string[],
    structuredData: [] as Record<string, unknown>[],
    userFacingContent: [] as string[]
  };
  
  for (const entry of knowledgeBase) {
    const fileName = entry.filePath.split('/').pop() || entry.filePath;
    
    // Check if file matches route targets
    const matchesRoute = route.targetFiles.some(target => 
      entry.filePath.toLowerCase().includes(target) ||
      fileName.toLowerCase().includes(target)
    );
    
    if (matchesRoute) {
      // Prioritize actual file content over placeholder text
      const isActualContent = entry.content.length > 100 && 
                             !entry.content.includes('CMS Config:') && 
                             !entry.content.includes('Content Count:') &&
                             (entry.metadata?.contentType === 'actual-file-content' || 
                              entry.content.includes('const ') || 
                              entry.content.includes('import ') ||
                              entry.content.includes('function '));
      
      if (isActualContent) {
        console.log(`📄 Processing actual file content: ${entry.filePath}`);
        
        // Extract business content with route-specific patterns
        const extractedContent = extractBusinessContent(entry.content, entry.filePath, route);
        
        if (extractedContent.businessLogic.length > 0) {
          // Calculate keyword matches for business logic
          const keywordMatches = keywords.filter(keyword => 
            extractedContent.businessLogic.some(logic => 
              logic.toLowerCase().includes(keyword.toLowerCase())
            )
          );
          
          // Calculate content relevance for business logic
          const contentRelevance = keywordMatches.length / keywords.length;
          
          // Higher score for route-matched files with actual content
          const finalScore = (extractedContent.confidence * 0.6) + (contentRelevance * 0.4) + 0.5; // Boost for actual content
          
          businessResults.push({
            filePath: entry.filePath,
            fileName: fileName,
            content: extractedContent.businessLogic.join('\n\n'),
            score: finalScore,
            relevance: finalScore,
            keywordMatches: keywordMatches,
            businessLogic: extractedContent.businessLogic,
            intent: route.intent
          });
          
          // Accumulate all extracted content
          allExtractedContent.businessLogic.push(...extractedContent.businessLogic);
          allExtractedContent.structuredData.push(...extractedContent.structuredData);
          allExtractedContent.userFacingContent.push(...extractedContent.userFacingContent);
        }
      } else {
        console.log(`⚠️  Skipping placeholder content: ${entry.filePath}`);
      }
    }
  }
  
  // Sort by relevance and get top results
  const sortedResults = businessResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  // Generate business response
  const businessResponse = generateBusinessResponse(
    originalQuestion,
    route,
    allExtractedContent,
    sortedResults
  );
  
  console.log(`✅ Enhanced business search found ${sortedResults.length} results for ${route.intent} intent`);
  console.log(`💬 Generated response: ${businessResponse.answer.substring(0, 100)}...`);
  console.log(`🎯 Confidence: ${businessResponse.confidence}`);
  
  return {
    searchResults: sortedResults,
    businessResponse,
    route
  };
}

/**
 * Test the enhanced business routing and response system
 */
export async function testEnhancedBusinessRouting(): Promise<void> {
  console.log('🧪 Testing enhanced business routing and response system...');
  
  // Test business question routing
  const testQuestions = [
    'Do we support payment processing in Canada?',
    'What is the pricing for enterprise plans?',
    'How does the onboarding process work?',
    'Can we integrate with Salesforce?',
    'What are the file size limits?',
    'Which countries do we operate in?'
  ];
  
  console.log('\n📋 Testing business question routing:');
  testQuestions.forEach(question => {
    const keywords = extractKeywords(question);
    const route = getBusinessQuestionRoute(question, keywords);
    console.log(`   "${question}" -> ${route.intent} (${route.responseFormat})`);
    console.log(`   Target files: ${route.targetFiles.slice(0, 3).join(', ')}...`);
  });
  
  // Test enhanced content extraction
  const testContent = `
    const config = {
      features: {
        paymentProcessing: true,
        analytics: false,
        integrations: ['stripe', 'paypal', 'square']
      },
      pricing: {
        basic: { price: 29, currency: 'USD' },
        pro: { price: 99, currency: 'USD' },
        enterprise: { price: 299, currency: 'USD' }
      },
      countries: ['US', 'CA', 'UK', 'AU', 'DE', 'FR'],
      limits: {
        fileSize: '100MB',
        users: 1000,
        storage: '10GB'
      },
      integrations: {
        stripe: { enabled: true, webhook: '/api/webhooks/stripe' },
        paypal: { enabled: true, webhook: '/api/webhooks/paypal' },
        salesforce: { enabled: false, reason: 'Coming soon' }
      }
    };
  `;
  
  console.log('\n🔍 Testing enhanced content extraction:');
  const capabilityRoute = getBusinessQuestionRoute('Do we support payment processing?', ['payment', 'processing']);
  const extractedContent = extractBusinessContent(testContent, 'test-config.js', capabilityRoute);
  console.log(`   Business logic found: ${extractedContent.businessLogic.length}`);
  console.log(`   Structured data found: ${extractedContent.structuredData.length}`);
  console.log(`   User-facing content found: ${extractedContent.userFacingContent.length}`);
  console.log(`   Confidence: ${extractedContent.confidence.toFixed(2)}`);
  
  // Test capability analysis
  console.log('\n✅ Testing capability analysis:');
  const capabilityAnalysis = analyzeCapabilityQuestion(testContent, ['payment', 'processing']);
  console.log(`   Answer: ${capabilityAnalysis.answer}`);
  console.log(`   Confidence: ${capabilityAnalysis.confidence.toFixed(2)}`);
  console.log(`   Evidence: ${capabilityAnalysis.evidence.slice(0, 2).join(', ')}...`);
  
  // Test business response generation
  console.log('\n💬 Testing business response generation:');
  const mockSearchResults: SearchResult[] = [
    {
      filePath: 'config/features.js',
      fileName: 'features.js',
      content: testContent,
      score: 0.8,
      relevance: 0.8,
      keywordMatches: ['payment', 'processing'],
      businessLogic: extractedContent.businessLogic,
      intent: 'capability'
    }
  ];
  
  const businessResponse = generateBusinessResponse(
    'Do we support payment processing?',
    capabilityRoute,
    extractedContent,
    mockSearchResults
  );
  
  console.log(`   Response: ${businessResponse.answer}`);
  console.log(`   Confidence: ${businessResponse.confidence}`);
  console.log(`   Response type: ${businessResponse.responseType}`);
  console.log(`   Evidence count: ${businessResponse.evidence.length}`);
  
  console.log('\n✅ Enhanced business routing test completed!');
}

/**
 * Universal integration file detection and targeting
 */
interface IntegrationPatterns {
  fileNames: string[];
  directoryPatterns: string[];
  contentPatterns: string[];
  importPatterns: string[];
  servicePatterns: string[];
  configPatterns: string[];
}

/**
 * Integration analysis results
 */
interface IntegrationAnalysis {
  services: string[];
  integrations: string[];
  webhooks: string[];
  apis: string[];
  providers: string[];
  connectors: string[];
  confidence: number;
  patterns: string[];
}

/**
 * Universal integration patterns for any codebase
 */
const integrationPatterns: IntegrationPatterns = {
  fileNames: [
    'integration', 'webhook', 'api', 'service', 'provider', 'client', 'connector',
    'adapter', 'gateway', 'bridge', 'plugin', 'sdk', 'wrapper', 'interface'
  ],
  directoryPatterns: [
    '/integrations/', '/services/', '/api/', '/webhooks/', '/providers/', '/connectors/',
    '/lib/services/', '/src/integrations/', '/config/services/', '/app/services/',
    '/src/api/', '/lib/api/', '/app/api/', '/src/webhooks/', '/lib/webhooks/',
    '/src/providers/', '/lib/providers/', '/app/providers/', '/src/connectors/',
    '/lib/connectors/', '/app/connectors/', '/src/clients/', '/lib/clients/',
    '/app/clients/', '/src/adapters/', '/lib/adapters/', '/app/adapters/',
    '/src/gateways/', '/lib/gateways/', '/app/gateways/', '/src/bridges/',
    '/lib/bridges/', '/app/bridges/', '/src/plugins/', '/lib/plugins/',
    '/app/plugins/', '/src/sdk/', '/lib/sdk/', '/app/sdk/', '/src/wrappers/',
    '/lib/wrappers/', '/app/wrappers/', '/src/interfaces/', '/lib/interfaces/',
    '/app/interfaces/'
  ],
  contentPatterns: [
    'api_key', 'api_key', 'webhook_url', 'webhook_url', 'service_url', 'service_url',
    'endpoint', 'endpoint', 'base_url', 'base_url', 'auth_token', 'auth_token',
    'client_id', 'client_id', 'client_secret', 'client_secret', 'access_token',
    'access_token', 'refresh_token', 'refresh_token', 'api_version', 'api_version',
    'service_name', 'service_name', 'provider_name', 'provider_name', 'integration_name',
    'integration_name', 'webhook_secret', 'webhook_secret', 'callback_url', 'callback_url'
  ],
  importPatterns: [
    // Node.js/npm patterns
    'require(', 'import ', 'from ', 'npm install', 'yarn add', 'pnpm add',
    // Python patterns
    'import ', 'from ', 'pip install', 'poetry add', 'conda install',
    // PHP patterns
    'use ', 'require_once', 'include_once', 'composer require',
    // Ruby patterns
    'require ', 'gem ', 'bundle add',
    // Java patterns
    'import ', 'maven', 'gradle', 'dependencies',
    // Go patterns
    'import ', 'go get', 'go mod',
    // .NET patterns
    'using ', 'nuget', 'dotnet add package',
    // Generic patterns
    'sdk', 'client', 'api', 'service', 'integration', 'webhook', 'provider'
  ],
  servicePatterns: [
    // Payment services
    'stripe', 'paypal', 'square', 'braintree', 'adyen', 'klarna', 'affirm',
    // Cloud services
    'aws', 'azure', 'gcp', 'google', 'amazon', 'microsoft', 'cloudflare',
    // Communication services
    'twilio', 'sendgrid', 'mailgun', 'mailchimp', 'intercom', 'zendesk',
    // Social media
    'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok',
    // Analytics
    'google_analytics', 'mixpanel', 'amplitude', 'segment', 'hotjar',
    // Storage
    's3', 'firebase', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
    // Authentication
    'auth0', 'okta', 'firebase_auth', 'cognito', 'keycloak',
    // CRM/ERP
    'salesforce', 'hubspot', 'pipedrive', 'zoho', 'monday', 'asana',
    // Development tools
    'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack', 'discord'
  ],
  configPatterns: [
    'config', 'settings', 'env', 'environment', 'credentials', 'secrets',
    'api_config', 'service_config', 'integration_config', 'webhook_config',
    'provider_config', 'client_config', 'connector_config', 'adapter_config'
  ]
};

/**
 * Analyze integration patterns in a codebase
 */
function analyzeIntegrationPatterns(knowledgeBase: KnowledgeEntry[]): IntegrationAnalysis {
  const analysis: IntegrationAnalysis = {
    services: [],
    integrations: [],
    webhooks: [],
    apis: [],
    providers: [],
    connectors: [],
    confidence: 0,
    patterns: []
  };
  
  const allContent = knowledgeBase.map(entry => entry.content).join(' ');
  const allPaths = knowledgeBase.map(entry => entry.filePath).join(' ');
  
  // Extract service names from content
  integrationPatterns.servicePatterns.forEach(service => {
    const serviceRegex = new RegExp(`\\b${service}\\b`, 'gi');
    if (serviceRegex.test(allContent)) {
      analysis.services.push(service);
      analysis.confidence += 0.1;
    }
  });
  
  // Extract integration patterns from file paths
  integrationPatterns.directoryPatterns.forEach(pattern => {
    if (allPaths.toLowerCase().includes(pattern.toLowerCase())) {
      analysis.patterns.push(pattern);
      analysis.confidence += 0.05;
    }
  });
  
  // Extract integration patterns from file names
  integrationPatterns.fileNames.forEach(name => {
    const nameRegex = new RegExp(`\\b${name}\\b`, 'gi');
    if (nameRegex.test(allPaths)) {
      analysis.patterns.push(name);
      analysis.confidence += 0.05;
    }
  });
  
  // Extract webhook patterns
  const webhookRegex = /webhook|webhook_url|webhook_secret|webhook_endpoint/gi;
  const webhookMatches = allContent.match(webhookRegex);
  if (webhookMatches) {
    analysis.webhooks = [...new Set(webhookMatches)];
    analysis.confidence += 0.2;
  }
  
  // Extract API patterns
  const apiRegex = /api_key|api_url|api_endpoint|api_version|api_client/gi;
  const apiMatches = allContent.match(apiRegex);
  if (apiMatches) {
    analysis.apis = [...new Set(apiMatches)];
    analysis.confidence += 0.2;
  }
  
  // Extract integration patterns
  const integrationRegex = /integration|integrate|integrated/gi;
  const integrationMatches = allContent.match(integrationRegex);
  if (integrationMatches) {
    analysis.integrations = [...new Set(integrationMatches)];
    analysis.confidence += 0.15;
  }
  
  // Extract provider patterns
  const providerRegex = /provider|service_provider|external_provider/gi;
  const providerMatches = allContent.match(providerRegex);
  if (providerMatches) {
    analysis.providers = [...new Set(providerMatches)];
    analysis.confidence += 0.15;
  }
  
  // Extract connector patterns
  const connectorRegex = /connector|connect|connection/gi;
  const connectorMatches = allContent.match(connectorRegex);
  if (connectorMatches) {
    analysis.connectors = [...new Set(connectorMatches)];
    analysis.confidence += 0.15;
  }
  
  analysis.confidence = Math.min(analysis.confidence, 1.0);
  
  return analysis;
}

/**
 * Enhanced integration file relevance scoring
 */
function getIntegrationFileRelevance(filePath: string, fileName: string, content: string): number {
  const lowerPath = filePath.toLowerCase();
  const lowerName = fileName.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  let score = 0;
  
  // File name relevance (highest weight)
  const nameMatches = integrationPatterns.fileNames.filter(name => 
    lowerName.includes(name.toLowerCase())
  );
  score += nameMatches.length * 0.4;
  
  // Directory pattern relevance (high weight)
  const directoryMatches = integrationPatterns.directoryPatterns.filter(pattern => 
    lowerPath.includes(pattern.toLowerCase())
  );
  score += directoryMatches.length * 0.3;
  
  // Content pattern relevance (medium weight)
  const contentMatches = integrationPatterns.contentPatterns.filter(pattern => 
    lowerContent.includes(pattern.toLowerCase())
  );
  score += contentMatches.length * 0.2;
  
  // Import pattern relevance (medium weight)
  const importMatches = integrationPatterns.importPatterns.filter(pattern => 
    lowerContent.includes(pattern.toLowerCase())
  );
  score += importMatches.length * 0.15;
  
  // Service pattern relevance (high weight)
  const serviceMatches = integrationPatterns.servicePatterns.filter(service => 
    lowerContent.includes(service.toLowerCase())
  );
  score += serviceMatches.length * 0.25;
  
  // Config pattern relevance (medium weight)
  const configMatches = integrationPatterns.configPatterns.filter(pattern => 
    lowerName.includes(pattern.toLowerCase()) || lowerPath.includes(pattern.toLowerCase())
  );
  score += configMatches.length * 0.2;
  
  // Boost for files with multiple integration indicators
  const totalIndicators = nameMatches.length + directoryMatches.length + 
                         contentMatches.length + importMatches.length + 
                         serviceMatches.length + configMatches.length;
  
  if (totalIndicators > 3) {
    score += 0.3; // Significant boost for files with multiple indicators
  }
  
  // Reduce score for generic application files
  const genericFiles = ['main', 'app', 'index', 'boot', 'start', 'entry', 'server', 'client'];
  const isGenericFile = genericFiles.some(generic => lowerName.includes(generic));
  if (isGenericFile && score < 0.5) {
    score *= 0.5; // Reduce score for generic files with low integration indicators
  }
  
  // Boost for high density of third-party service mentions
  const serviceMentionCount = integrationPatterns.servicePatterns.reduce((count, service) => {
    const regex = new RegExp(service, 'gi');
    const matches = content.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  if (serviceMentionCount > 5) {
    score += 0.2; // Boost for files with many service mentions
  }
  
  return Math.min(score, 1.0);
}

/**
 * Enhanced integration content extraction with actual file content
 */
function extractIntegrationContent(content: string, filePath: string): {
  services: string[];
  integrations: string[];
  webhooks: string[];
  apis: string[];
  configs: string[];
  imports: string[];
  documentation: string[];
  confidence: number;
} {
  console.log(`🔍 Extracting integration content from ${filePath} (${content.length} characters)`);
  
  const services: string[] = [];
  const integrations: string[] = [];
  const webhooks: string[] = [];
  const apis: string[] = [];
  const configs: string[] = [];
  const imports: string[] = [];
  const documentation: string[] = [];
  let confidence = 0;
  
  // Check if this is actual file content or placeholder text
  const isActualContent = content.length > 100 && !content.includes('CMS Config:') && !content.includes('Content Count:');
  
  if (!isActualContent) {
    console.log(`⚠️  Skipping placeholder content for ${filePath}`);
    return {
      services,
      integrations,
      webhooks,
      apis,
      configs,
      imports,
      documentation,
      confidence: 0
    };
  }
  
  console.log(`✅ Processing actual file content for ${filePath}`);
  
  // Extract service names
  integrationPatterns.servicePatterns.forEach(service => {
    const serviceRegex = new RegExp(`\\b${service}\\b`, 'gi');
    const matches = content.match(serviceRegex);
    if (matches) {
      services.push(service);
      confidence += 0.1;
      console.log(`🔗 Found service: ${service}`);
    }
  });
  
  // Extract integration configurations
  const integrationConfigPatterns = [
    /(?:integration|service|provider|client)\s*[:=]\s*\{([^}]+)\}/gi,
    /(?:api_key|webhook_url|service_url|endpoint)\s*[:=]\s*([^,\n]+)/gi,
    /(?:config|settings)\s*[:=]\s*\{([^}]+)\}/gi
  ];
  
  integrationConfigPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        configs.push(match);
        confidence += 0.15;
        console.log(`⚙️  Found config: ${match.substring(0, 50)}...`);
      });
    }
  });
  
  // Extract webhook configurations
  const webhookPatterns = [
    /webhook\s*[:=]\s*([^,\n]+)/gi,
    /webhook_url\s*[:=]\s*([^,\n]+)/gi,
    /webhook_secret\s*[:=]\s*([^,\n]+)/gi,
    /webhook_endpoint\s*[:=]\s*([^,\n]+)/gi
  ];
  
  webhookPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        webhooks.push(match);
        confidence += 0.15;
        console.log(`🔗 Found webhook: ${match.substring(0, 50)}...`);
      });
    }
  });
  
  // Extract API configurations
  const apiPatterns = [
    /api_key\s*[:=]\s*([^,\n]+)/gi,
    /api_url\s*[:=]\s*([^,\n]+)/gi,
    /api_endpoint\s*[:=]\s*([^,\n]+)/gi,
    /api_version\s*[:=]\s*([^,\n]+)/gi
  ];
  
  apiPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        apis.push(match);
        confidence += 0.15;
        console.log(`🔌 Found API: ${match.substring(0, 50)}...`);
      });
    }
  });
  
  // Extract import statements
  integrationPatterns.importPatterns.forEach(pattern => {
    const importRegex = new RegExp(`(${pattern}[^\\n]+)`, 'gi');
    const matches = content.match(importRegex);
    if (matches) {
      matches.forEach(match => {
        imports.push(match);
        confidence += 0.1;
        console.log(`📦 Found import: ${match.substring(0, 50)}...`);
      });
    }
  });
  
  // Extract integration documentation
  const docPatterns = [
    /\/\*\*?([^*]+)\*\//g,
    /\/\/\s*([^\n]+)/g,
    /#\s*([^\n]+)/g,
    /<!--\s*([^>]+)-->/g
  ];
  
  docPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.replace(/\/\*\*?|\*\//g, '').replace(/\/\/\s*/, '').replace(/#\s*/, '').replace(/<!--\s*|\s*-->/g, '').trim();
        if (cleanMatch.length > 10 && integrationPatterns.servicePatterns.some(service => 
          cleanMatch.toLowerCase().includes(service.toLowerCase())
        )) {
          documentation.push(cleanMatch);
          confidence += 0.05;
          console.log(`📝 Found documentation: ${cleanMatch.substring(0, 50)}...`);
        }
      });
    }
  });
  
  // Extract integration patterns
  const integrationPatternsLocal = [
    /integration\s*[:=]\s*([^,\n]+)/gi,
    /integrate\s*[:=]\s*([^,\n]+)/gi,
    /service\s*[:=]\s*([^,\n]+)/gi,
    /provider\s*[:=]\s*([^,\n]+)/gi
  ];
  
  integrationPatternsLocal.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        integrations.push(match);
        confidence += 0.15;
        console.log(`🔗 Found integration: ${match.substring(0, 50)}...`);
      });
    }
  });
  
  console.log(`✅ Integration extraction complete for ${filePath}: ${services.length} services, ${integrations.length} integrations, ${webhooks.length} webhooks, ${apis.length} APIs, confidence: ${confidence.toFixed(2)}`);
  
  return {
    services,
    integrations,
    webhooks,
    apis,
    configs,
    imports,
    documentation,
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Enhanced integration question routing
 */
function getIntegrationQuestionRoute(originalQuestion: string, keywords: string[]): BusinessQuestionRoute {
  const lowerQuestion = originalQuestion.toLowerCase();
  
  // Enhanced integration routing with more specific patterns
  const route: BusinessQuestionRoute = {
    intent: 'integration',
    targetFiles: [
      'integration', 'webhook', 'api', 'service', 'provider', 'client', 'connector',
      'adapter', 'gateway', 'bridge', 'plugin', 'sdk', 'wrapper', 'interface'
    ],
    contentTypes: [
      'API definitions', 'webhook handlers', 'third-party configs', 'integration guides',
      'service configurations', 'provider setups', 'client initializations', 'SDK configurations'
    ],
    responseFormat: 'detailed',
    confidenceFactors: [
      'API endpoints', 'webhook configs', 'integration status', 'third-party lists',
      'service configurations', 'authentication methods', 'endpoint definitions'
    ]
  };
  
  // Add specific service patterns based on question content
  if (lowerQuestion.includes('platform') || lowerQuestion.includes('service')) {
    route.targetFiles.push('platform', 'external', 'third-party');
  }
  
  if (lowerQuestion.includes('api') || lowerQuestion.includes('endpoint')) {
    route.targetFiles.push('api', 'endpoint', 'rest', 'graphql');
  }
  
  if (lowerQuestion.includes('webhook') || lowerQuestion.includes('callback')) {
    route.targetFiles.push('webhook', 'callback', 'hook');
  }
  
  if (lowerQuestion.includes('auth') || lowerQuestion.includes('authentication')) {
    route.targetFiles.push('auth', 'authentication', 'oauth', 'jwt');
  }
  
  return route;
}

/**
 * Test the enhanced integration targeting system
 */
export async function testEnhancedIntegrationTargeting(): Promise<void> {
  console.log('🧪 Testing enhanced integration targeting system...');
  
  // Test integration question routing
  const testIntegrationQuestions = [
    'What platforms/services does this app integrate with?',
    'Do we support Stripe payments?',
    'Can we integrate with Salesforce?',
    'What webhooks are available?',
    'Which APIs do we use?',
    'What third-party services are configured?'
  ];
  
  console.log('\n📋 Testing integration question routing:');
  testIntegrationQuestions.forEach(question => {
    const keywords = extractKeywords(question);
    const route = getIntegrationQuestionRoute(question, keywords);
    console.log(`   "${question}" -> ${route.intent} (${route.responseFormat})`);
    console.log(`   Target files: ${route.targetFiles.slice(0, 5).join(', ')}...`);
  });
  
  // Test integration patterns analysis
  const testIntegrationContent = `
    // Stripe integration configuration
    const stripeConfig = {
      api_key: 'sk_test_1234567890',
      webhook_secret: 'whsec_1234567890',
      api_version: '2023-10-16'
    };
    
    // PayPal integration
    const paypalConfig = {
      client_id: 'client_id_123456',
      client_secret: 'client_secret_123456',
      webhook_url: 'https://api.example.com/webhooks/paypal'
    };
    
    // Salesforce integration
    import { SalesforceClient } from '@salesforce/client';
    const salesforce = new SalesforceClient({
      username: 'user@example.com',
      password: 'password123',
      securityToken: 'token123'
    });
    
    // AWS S3 integration
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: 'AKIA1234567890',
      secretAccessKey: 'secret1234567890',
      region: 'us-east-1'
    });
    
    // Twilio integration
    const twilio = require('twilio');
    const client = twilio('AC1234567890', 'auth_token_123456');
    
    // MongoDB integration
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://localhost:27017/myapp');
  `;
  
  console.log('\n🔍 Testing integration patterns analysis:');
  const mockEntries: KnowledgeEntry[] = [
    {
      filePath: 'config/integrations.js',
      content: testIntegrationContent,
      keywords: ['stripe', 'paypal', 'salesforce', 'aws', 'twilio', 'mongodb'],
      type: 'config'
    }
  ];
  
  const integrationAnalysis = analyzeIntegrationPatterns(mockEntries);
  console.log(`   Services found: ${integrationAnalysis.services.join(', ')}`);
  console.log(`   Webhooks found: ${integrationAnalysis.webhooks.join(', ')}`);
  console.log(`   APIs found: ${integrationAnalysis.apis.join(', ')}`);
  console.log(`   Confidence: ${integrationAnalysis.confidence.toFixed(2)}`);
  
  // Test integration file relevance scoring
  console.log('\n📊 Testing integration file relevance scoring:');
  const testFiles = [
    { path: 'src/integrations/stripe.js', name: 'stripe.js', content: testIntegrationContent },
    { path: 'src/services/payment.js', name: 'payment.js', content: testIntegrationContent },
    { path: 'config/api.js', name: 'api.js', content: testIntegrationContent },
    { path: 'src/main.js', name: 'main.js', content: testIntegrationContent },
    { path: 'package.json', name: 'package.json', content: testIntegrationContent }
  ];
  
  testFiles.forEach(file => {
    const relevance = getIntegrationFileRelevance(file.path, file.name, file.content);
    console.log(`   ${file.name}: ${relevance.toFixed(2)}`);
  });
  
  // Test integration content extraction
  console.log('\n🔍 Testing integration content extraction:');
  const extractedContent = extractIntegrationContent(testIntegrationContent, 'test-integrations.js');
  console.log(`   Services: ${extractedContent.services.join(', ')}`);
  console.log(`   Integrations: ${extractedContent.integrations.length}`);
  console.log(`   Webhooks: ${extractedContent.webhooks.length}`);
  console.log(`   APIs: ${extractedContent.apis.length}`);
  console.log(`   Configs: ${extractedContent.configs.length}`);
  console.log(`   Imports: ${extractedContent.imports.length}`);
  console.log(`   Documentation: ${extractedContent.documentation.length}`);
  console.log(`   Confidence: ${extractedContent.confidence.toFixed(2)}`);
  
  // Test enhanced integration search
  console.log('\n🔗 Testing enhanced integration search:');
  const integrationSearchResult = await searchBusinessKnowledgeEnhanced(
    'What platforms/services does this app integrate with?',
    ['platform', 'service', 'integrate'],
    mockEntries
  );
  
  console.log(`   Search results: ${integrationSearchResult.searchResults.length}`);
  console.log(`   Response: ${integrationSearchResult.businessResponse.answer.substring(0, 100)}...`);
  console.log(`   Confidence: ${integrationSearchResult.businessResponse.confidence}`);
  console.log(`   Response type: ${integrationSearchResult.businessResponse.responseType}`);
  
  console.log('\n✅ Enhanced integration targeting test completed!');
}

/**
 * Test the content extraction system
 */
export async function testContentExtraction(): Promise<void> {
  console.log('🧪 Testing content extraction system...');
  
  // Test with mock integration file content
  const mockIntegrationContent = `
    // Stripe integration configuration
    const stripeConfig = {
      api_key: 'sk_test_1234567890',
      webhook_secret: 'whsec_1234567890',
      api_version: '2023-10-16'
    };
    
    // PayPal integration
    const paypalConfig = {
      client_id: 'client_id_123456',
      client_secret: 'client_secret_123456',
      webhook_url: 'https://api.example.com/webhooks/paypal'
    };
    
    // Salesforce integration
    import { SalesforceClient } from '@salesforce/client';
    const salesforce = new SalesforceClient({
      username: 'user@example.com',
      password: 'password123',
      securityToken: 'token123'
    });
    
    // AWS S3 integration
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: 'AKIA1234567890',
      secretAccessKey: 'secret1234567890',
      region: 'us-east-1'
    });
    
    // Twilio integration
    const twilio = require('twilio');
    const client = twilio('AC1234567890', 'auth_token_123456');
    
    // MongoDB integration
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://localhost:27017/myapp');
  `;
  
  // Test with placeholder content
  const placeholderContent = 'CMS Config: Ghost with content types: none...';
  
  console.log('\n📄 Testing actual file content extraction:');
  const actualContentResult = extractIntegrationContent(mockIntegrationContent, 'test-integrations.js');
  console.log(`   Services found: ${actualContentResult.services.join(', ')}`);
  console.log(`   Integrations found: ${actualContentResult.integrations.length}`);
  console.log(`   Webhooks found: ${actualContentResult.webhooks.length}`);
  console.log(`   APIs found: ${actualContentResult.apis.length}`);
  console.log(`   Confidence: ${actualContentResult.confidence.toFixed(2)}`);
  
  console.log('\n⚠️  Testing placeholder content extraction:');
  const placeholderResult = extractIntegrationContent(placeholderContent, 'test-placeholder.js');
  console.log(`   Services found: ${placeholderResult.services.length}`);
  console.log(`   Confidence: ${placeholderResult.confidence.toFixed(2)}`);
  
  // Test business logic extraction
  console.log('\n💼 Testing business logic extraction:');
  const businessLogicResult = extractUniversalBusinessLogic(mockIntegrationContent, 'test-integrations.js');
  console.log(`   Business logic items found: ${businessLogicResult.length}`);
  businessLogicResult.slice(0, 3).forEach(item => {
    console.log(`   - ${item.substring(0, 50)}...`);
  });
  
  // Test with mock knowledge base entries
  const mockKnowledgeBase: KnowledgeEntry[] = [
    {
      filePath: 'config/integrations.js',
      content: mockIntegrationContent,
      keywords: ['stripe', 'paypal', 'salesforce', 'aws', 'twilio', 'mongodb'],
      type: 'content',
      metadata: {
        contentType: 'actual-file-content',
        fileSize: mockIntegrationContent.length,
        fileName: 'integrations.js'
      }
    },
    {
      filePath: 'config/placeholder.js',
      content: placeholderContent,
      keywords: ['cms', 'config', 'ghost'],
      type: 'content',
      metadata: {
        contentType: 'content-summary',
        originalContentLength: placeholderContent.length
      }
    }
  ];
  
  console.log('\n🔍 Testing enhanced business search with actual content:');
  const searchResult = await searchBusinessKnowledgeEnhanced(
    'What platforms/services does this app integrate with?',
    ['platform', 'service', 'integrate'],
    mockKnowledgeBase
  );
  
  console.log(`   Search results: ${searchResult.searchResults.length}`);
  console.log(`   Response: ${searchResult.businessResponse.answer.substring(0, 100)}...`);
  console.log(`   Confidence: ${searchResult.businessResponse.confidence}`);
  console.log(`   Response type: ${searchResult.businessResponse.responseType}`);
  
  // Show the actual content being processed
  console.log('\n📋 Content processing summary:');
  searchResult.searchResults.forEach((result, index) => {
    console.log(`   Result ${index + 1}: ${result.fileName}`);
    console.log(`     Content length: ${result.content.length} characters`);
    console.log(`     Score: ${result.score.toFixed(2)}`);
    console.log(`     Content preview: ${result.content.substring(0, 100)}...`);
  });
  
  console.log('\n✅ Content extraction test completed!');
}

/**
 * Clear all caches and force a complete re-scan of the repository
 * This is useful when the cached data contains placeholder content instead of actual file content
 */
export async function forceRepositoryRescan(): Promise<void> {
  console.log('🔄 Starting forced repository re-scan...');
  
  try {
    // Clear all caches
    clearProcessedFilesCache();
    clearScanCache();
    clearSuccessfulPathPatterns();
    resetExplorationProgress();
    
    // Clear localStorage cache
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => 
        key.includes('unfold_scan_cache') || 
        key.includes('knowledge_base') ||
        key.includes('processed_files')
      );
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Cleared cache key: ${key}`);
      });
      
      console.log(`🗑️ Cleared ${cacheKeys.length} cache entries`);
    } catch (error) {
      console.error('Error clearing localStorage cache:', error);
    }
    
    // Reset initialization state by clearing the knowledge base
    knowledgeBase = [];
    
    // Force re-initialization
    console.log('🔄 Re-initializing knowledge base with fresh scan...');
    await initializeKnowledgeBase(true);
    
    console.log('✅ Forced repository re-scan complete');
  } catch (error) {
    console.error('❌ Error during forced repository re-scan:', error);
    throw error;
  }
}

/**
 * Get comprehensive scanning diagnostics
 */
export function getComprehensiveScanDiagnostics(): {
  knowledgeBaseSize: number;
  usingMockData: boolean;
  scanProgress: ReturnType<typeof getExplorationProgress>;
  connectionStatus: ReturnType<typeof getConnectionDiagnostics>;
  cacheStatus: {
    hasCache: boolean;
    cacheAge: number;
    cacheSize: number;
  };
  recommendations: string[];
} {
  const enhanced = getEnhancedDiagnostics();
  const scanProgress = getExplorationProgress();
  const connectionStatus = getConnectionDiagnostics();
  
  // Check cache status
  let hasCache = false;
  let cacheAge = 0;
  let cacheSize = 0;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => 
      key.includes('unfold_scan_cache') || 
      key.includes('knowledge_base')
    );
    
    hasCache = cacheKeys.length > 0;
    cacheSize = cacheKeys.length;
    
    if (hasCache) {
      const now = Date.now();
      let oldestCache = now;
      
      cacheKeys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.lastScanTime) {
              oldestCache = Math.min(oldestCache, parsed.lastScanTime);
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });
      
      cacheAge = now - oldestCache;
    }
  } catch (error) {
    console.error('Error checking cache status:', error);
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (enhanced.usingMockData) {
    recommendations.push('Repository connection issue detected - using sample data');
    recommendations.push('Verify GitHub token has repository read permissions');
  }
  
  if (scanProgress.filesProcessed < 10) {
    recommendations.push('Very few files scanned - repository may be inaccessible');
    recommendations.push('Check repository URL and authentication');
  }
  
  if (scanProgress.connectionErrors && scanProgress.connectionErrors.length > 0) {
    recommendations.push(`${scanProgress.connectionErrors.length} connection errors detected`);
    recommendations.push('Check network connectivity and API rate limits');
  }
  
  if (cacheAge > 24 * 60 * 60 * 1000) { // 24 hours
    recommendations.push('Cache is older than 24 hours - consider refreshing');
  }
  
  if (enhanced.knowledgeBaseSize < 50) {
    recommendations.push('Knowledge base is very small - scanning may be incomplete');
  }
  
  return {
    knowledgeBaseSize: enhanced.knowledgeBaseSize,
    usingMockData: enhanced.usingMockData,
    scanProgress,
    connectionStatus,
    cacheStatus: {
      hasCache,
      cacheAge,
      cacheSize
    },
    recommendations
  };
}

/**
 * Test the universal scanning system to verify it can scan 100-500 files
 * This function helps debug scanning issues and verify the system works for any codebase
 */
export async function testUniversalScanning(): Promise<{
  success: boolean;
  filesScanned: number;
  directoriesExplored: number;
  scanDuration: number;
  errors: string[];
  recommendations: string[];
}> {
  console.log('🧪 Testing universal scanning system...');
  
  const startTime = Date.now();
  const errors: string[] = [];
  const recommendations: string[] = [];
  
  try {
    // Clear all caches first
    clearProcessedFilesCache();
    clearScanCache();
    clearSuccessfulPathPatterns();
    resetExplorationProgress();
    
    // Force a fresh scan
    await initializeKnowledgeBase(true);
    
    const scanDuration = Date.now() - startTime;
    const scanProgress = getExplorationProgress();
    const stats = getKnowledgeBaseStats();
    const diagnostics = getComprehensiveScanDiagnostics();
    
    console.log('🧪 Universal scanning test results:');
    console.log(`   📄 Files scanned: ${scanProgress.filesProcessed}`);
    console.log(`   📁 Directories explored: ${scanProgress.directoriesExplored?.length || 0}`);
    console.log(`   ⏱️  Scan duration: ${scanDuration}ms`);
    console.log(`   🧠 Knowledge base entries: ${stats.totalEntries}`);
    console.log(`   📊 Success rate: ${diagnostics.scanProgress?.totalFilesAvailable > 0 
      ? Math.round((scanProgress.filesProcessed / diagnostics.scanProgress.totalFilesAvailable) * 100) 
      : 0}%`);
    
    // Check if scanning was successful
    const success = scanProgress.filesProcessed >= 10 && !diagnostics.usingMockData;
    
    if (scanProgress.filesProcessed < 10) {
      errors.push(`Only ${scanProgress.filesProcessed} files scanned - should be 100-500`);
      recommendations.push('Check repository connection and permissions');
      recommendations.push('Verify GitHub token has repository read access');
    }
    
    if (diagnostics.usingMockData) {
      errors.push('Using mock data instead of real repository content');
      recommendations.push('Repository connection failed - check authentication');
    }
    
    if (scanProgress.connectionErrors && scanProgress.connectionErrors.length > 0) {
      errors.push(`${scanProgress.connectionErrors.length} connection errors occurred`);
      recommendations.push('Check network connectivity and API rate limits');
    }
    
    if (scanProgress.filesProcessed >= 100) {
      console.log('✅ Excellent! Scanned 100+ files successfully');
    } else if (scanProgress.filesProcessed >= 50) {
      console.log('⚠️  Good! Scanned 50+ files, but could scan more');
      recommendations.push('Consider increasing scanning depth for better coverage');
    } else if (scanProgress.filesProcessed >= 10) {
      console.log('⚠️  Basic scan completed, but coverage is limited');
      recommendations.push('Repository may be small or have limited accessible files');
    } else {
      console.log('❌ Scanning failed - very few files found');
    }
    
    return {
      success,
      filesScanned: scanProgress.filesProcessed,
      directoriesExplored: scanProgress.directoriesExplored?.length || 0,
      scanDuration,
      errors,
      recommendations: [...recommendations, ...diagnostics.recommendations]
    };
    
  } catch (error) {
    const scanDuration = Date.now() - startTime;
    console.error('❌ Universal scanning test failed:', error);
    
    errors.push(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    recommendations.push('Check console for detailed error information');
    recommendations.push('Verify repository configuration and network connectivity');
    
    return {
      success: false,
      filesScanned: 0,
      directoriesExplored: 0,
      scanDuration,
      errors,
      recommendations
    };
  }
}

/**
 * Test basic search functionality to ensure JSON serialization fix is working
 */
export function testBasicSearchFunctionality(): {
  success: boolean;
  error?: string;
  searchResults?: KnowledgeEntry[];
} {
  console.log('🧪 Testing basic search functionality...');
  
  try {
    // Test 1: Check if knowledge base is accessible
    if (!knowledgeBase || knowledgeBase.length === 0) {
      return {
        success: false,
        error: 'Knowledge base is empty or not accessible'
      };
    }
    
    // Test 2: Test safe JSON serialization
    const testObject = {
      normal: 'value',
      nested: {
        data: 'test',
        frontmatter: {
          title: 'Test'
        }
      }
    };
    
    try {
      const serialized = safeStringify(testObject);
      console.log('✅ Safe JSON serialization test passed');
    } catch (error) {
      return {
        success: false,
        error: `Safe JSON serialization failed: ${error}`
      };
    }
    
    // Test 3: Test basic search
    const searchResults = searchKnowledge('test');
    
    console.log('✅ Basic search test passed');
    console.log(`📊 Found ${searchResults.length} results`);
    
    return {
      success: true,
      searchResults
    };
    
  } catch (error) {
    console.error('❌ Basic search functionality test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
