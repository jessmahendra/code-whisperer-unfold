import { getRepositoryContents, getCurrentRepository } from '../githubConnector';
import { processFile, processModule } from './fileProcessor';
import { KnowledgeEntry } from './types';

// Track successful path patterns
const successfulPathPatterns: Set<string> = new Set();
let explorationProgress = {
  pathsAttempted: 0,
  pathsSuccessful: 0,
  filesProcessed: 0,
  status: "idle" as "idle" | "exploring" | "complete" | "error",
  progress: 0,
  error: null as string | null,
  totalAttempts: 0,
  successfulPaths: 0,
  scannedFiles: [] as string[],
  repositoryFingerprint: null as string | null,
  // Enhanced tracking for universal scanning
  totalFilesAvailable: 0,
  directoriesExplored: [] as string[],
  currentDirectory: "",
  scanStartTime: 0,
  scanDuration: 0,
  rateLimitRemaining: null as number | null,
  connectionErrors: [] as string[]
};

// Progress update callback
let progressUpdateCallback: ((progress: number) => void) | null = null;

// Universal repository scanning configuration
const SCANNING_CONFIG = {
  MIN_FILES_TO_SCAN: 100,
  TARGET_FILES_TO_SCAN: 500,
  MAX_FILES_TO_SCAN: 1000,
  MAX_RECURSION_DEPTH: 8,
  MAX_FILES_PER_DIRECTORY: 200,
  RATE_LIMIT_DELAY: 100, // ms between API calls
  TIMEOUT_PER_REQUEST: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3
};

// Universal directory patterns for comprehensive scanning
const UNIVERSAL_DIRECTORY_PATTERNS = [
  // Root level important files
  'package.json', 'README.md', 'tsconfig.json', 'vite.config.ts', 'next.config.js',
  'tailwind.config.js', 'webpack.config.js', 'rollup.config.js', 'jest.config.js',
  
  // Common source directories
  'src', 'app', 'lib', 'components', 'pages', 'services', 'utils', 'hooks',
  'api', 'routes', 'controllers', 'models', 'middleware', 'types', 'interfaces',
  'store', 'context', 'providers', 'helpers', 'adapters', 'plugins', 'extensions',
  
  // Configuration and documentation
  'config', 'settings', 'docs', 'documentation', 'examples', 'tests', 'spec',
  'scripts', 'tools', 'build', 'dist', 'public', 'assets', 'static',
  
  // Framework-specific directories
  'pages', 'components', 'layouts', 'templates', 'views', 'screens',
  'services', 'repositories', 'entities', 'dto', 'guards', 'decorators',
  
  // Integration and external services
  'integrations', 'providers', 'clients', 'connectors', 'adapters',
  'webhooks', 'callbacks', 'handlers', 'processors', 'validators',
  
  // Business logic directories
  'business', 'domain', 'core', 'features', 'modules', 'packages',
  'apps', 'microservices', 'services', 'api', 'graphql', 'rest',
  
  // Ghost-specific paths (for backward compatibility)
  'ghost', 'ghost/core', 'ghost/admin', 'apps/portal', 'apps/admin-x-settings',
  'apps/admin-x-activitypub', 'apps/admin-x-design', 'apps/signup-form'
];

/**
 * Generate repository fingerprint to detect changes
 */
function generateRepositoryFingerprint(): string {
  const repo = getCurrentRepository();
  if (!repo) return 'no-repo';
  return `${repo.owner}/${repo.repo}`;
}

/**
 * Set progress update callback
 */
export function setProgressUpdateCallback(callback: (progress: number) => void): void {
  progressUpdateCallback = callback;
}

/**
 * Update progress and notify callback
 */
function updateProgress(progress: number): void {
  explorationProgress.progress = progress;
  if (progressUpdateCallback) {
    progressUpdateCallback(progress);
  }
}

/**
 * Enhanced universal repository scanning with comprehensive coverage
 */
export async function exploreRepositoryPaths(knowledgeBase: KnowledgeEntry[]): Promise<boolean> {
  const repo = getCurrentRepository();
  if (!repo) {
    console.log('❌ No repository configured for path exploration');
    explorationProgress.status = "error";
    explorationProgress.error = "No repository configured";
    return false;
  }

  const currentFingerprint = generateRepositoryFingerprint();
  console.log(`🚀 Starting UNIVERSAL repository exploration for ${repo.owner}/${repo.repo}`);
  console.log(`📊 Target: ${SCANNING_CONFIG.TARGET_FILES_TO_SCAN} files, Max: ${SCANNING_CONFIG.MAX_FILES_TO_SCAN} files`);
  
  // Reset progress tracking with enhanced metrics
  explorationProgress = {
    pathsAttempted: 0,
    pathsSuccessful: 0,
    filesProcessed: 0,
    status: "exploring",
    progress: 0,
    error: null,
    totalAttempts: 0,
    successfulPaths: 0,
    scannedFiles: [],
    repositoryFingerprint: currentFingerprint,
    totalFilesAvailable: 0,
    directoriesExplored: [],
    currentDirectory: "",
    scanStartTime: Date.now(),
    scanDuration: 0,
    rateLimitRemaining: null,
    connectionErrors: []
  };

  let hasProcessedAnyFiles = false;
  let totalFilesFound = 0;
  const directoriesToExplore: string[] = [];
  const exploredDirectories = new Set<string>();

  try {
    // Step 1: Start from repository root to understand structure
    console.log(`🔍 Step 1: Analyzing repository root structure...`);
    updateProgress(5);
    
    const rootContents = await getRepositoryContents("");
    if (Array.isArray(rootContents)) {
      console.log(`📁 Root directory contains ${rootContents.length} items`);
      
      // Count total files and identify directories to explore
      for (const item of rootContents) {
        if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
          const typedItem = item as { type: string; name: string; path: string };
          
          if (typedItem.type === 'file') {
            totalFilesFound++;
            if (isRelevantFile(typedItem.name, false)) {
              try {
                console.log(`📄 Processing root file: ${typedItem.path}`);
                await processFile(typedItem.path, knowledgeBase);
                hasProcessedAnyFiles = true;
                explorationProgress.filesProcessed++;
                explorationProgress.scannedFiles.push(typedItem.path);
              } catch (error) {
                console.error(`Error processing root file ${typedItem.path}:`, error);
                explorationProgress.connectionErrors.push(`Root file error: ${error}`);
              }
            }
          } else if (typedItem.type === 'dir') {
            directoriesToExplore.push(typedItem.path);
            console.log(`📂 Found directory to explore: ${typedItem.path}`);
          }
        }
      }
    }

    // Step 2: Explore important directories systematically
    console.log(`🔍 Step 2: Exploring ${directoriesToExplore.length} directories systematically...`);
    updateProgress(15);

    // Sort directories by importance for better coverage
    const sortedDirectories = sortDirectoriesByImportance(directoriesToExplore);
    
    for (let i = 0; i < sortedDirectories.length; i++) {
      const dirPath = sortedDirectories[i];
      
      if (explorationProgress.filesProcessed >= SCANNING_CONFIG.MAX_FILES_TO_SCAN) {
        console.log(`⚠️ Reached maximum file limit (${SCANNING_CONFIG.MAX_FILES_TO_SCAN}), stopping exploration`);
        break;
      }
      
      if (exploredDirectories.has(dirPath)) continue;
      
      explorationProgress.currentDirectory = dirPath;
      explorationProgress.pathsAttempted++;
      
      const progress = 15 + Math.round((i / sortedDirectories.length) * 70);
      updateProgress(progress);
      
      try {
        console.log(`🔍 Exploring directory ${i + 1}/${sortedDirectories.length}: ${dirPath}`);
        const filesInDir = await exploreDirectoryRecursively(dirPath, knowledgeBase, 1, exploredDirectories);
        totalFilesFound += filesInDir;
        
        if (filesInDir > 0) {
          explorationProgress.pathsSuccessful++;
          explorationProgress.directoriesExplored.push(dirPath);
          hasProcessedAnyFiles = true;
        }
        
        // Add delay to respect rate limits
        await delay(SCANNING_CONFIG.RATE_LIMIT_DELAY);
        
      } catch (error) {
        console.error(`Error exploring directory ${dirPath}:`, error);
        explorationProgress.connectionErrors.push(`Directory error: ${error}`);
      }
    }

    // Step 3: Try specific important paths if we haven't found enough files
    if (explorationProgress.filesProcessed < SCANNING_CONFIG.MIN_FILES_TO_SCAN) {
      console.log(`🔍 Step 3: Trying specific important paths to reach minimum file count...`);
      updateProgress(90);
      
      for (const pattern of UNIVERSAL_DIRECTORY_PATTERNS) {
        if (explorationProgress.filesProcessed >= SCANNING_CONFIG.MIN_FILES_TO_SCAN) break;
        
        if (!exploredDirectories.has(pattern)) {
          try {
            console.log(`🔍 Trying specific path: ${pattern}`);
            const filesInPath = await exploreDirectoryRecursively(pattern, knowledgeBase, 1, exploredDirectories);
            totalFilesFound += filesInPath;
            
            if (filesInPath > 0) {
              explorationProgress.pathsSuccessful++;
              explorationProgress.directoriesExplored.push(pattern);
              hasProcessedAnyFiles = true;
            }
            
            await delay(SCANNING_CONFIG.RATE_LIMIT_DELAY);
          } catch (error) {
            // Silently continue - this path might not exist
          }
        }
      }
    }

    // Calculate final statistics
    explorationProgress.scanDuration = Date.now() - explorationProgress.scanStartTime;
    explorationProgress.totalFilesAvailable = totalFilesFound;
    explorationProgress.status = "complete";
    updateProgress(100);
    
    console.log(`🎉 UNIVERSAL Repository scan complete!`);
    console.log(`📊 Comprehensive Scan Summary:`);
    console.log(`   ⏱️  Duration: ${explorationProgress.scanDuration}ms`);
    console.log(`   📁 Directories explored: ${explorationProgress.directoriesExplored.length}`);
    console.log(`   📄 Files processed: ${explorationProgress.filesProcessed}/${totalFilesFound} available`);
    console.log(`   🎯 Success rate: ${Math.round((explorationProgress.filesProcessed / totalFilesFound) * 100)}%`);
    console.log(`   📍 Repository: ${explorationProgress.repositoryFingerprint}`);
    
    if (explorationProgress.connectionErrors.length > 0) {
      console.log(`⚠️  Connection errors: ${explorationProgress.connectionErrors.length}`);
    }
    
    console.log(`📋 Sample scanned files:`, explorationProgress.scannedFiles.slice(0, 10));
    console.log(`📂 Explored directories:`, explorationProgress.directoriesExplored.slice(0, 10));

    return hasProcessedAnyFiles;
  } catch (error) {
    explorationProgress.status = "error";
    explorationProgress.error = error instanceof Error ? error.message : "Unknown error";
    explorationProgress.scanDuration = Date.now() - explorationProgress.scanStartTime;
    console.error("❌ Error during universal repository exploration:", error);
    return false;
  }
}

/**
 * Enhanced recursive directory exploration with better file handling
 */
async function exploreDirectoryRecursively(
  dirPath: string, 
  knowledgeBase: KnowledgeEntry[], 
  currentDepth: number,
  exploredDirectories: Set<string>
): Promise<number> {
  if (currentDepth > SCANNING_CONFIG.MAX_RECURSION_DEPTH) {
    console.log(`⚠️ Max recursion depth (${SCANNING_CONFIG.MAX_RECURSION_DEPTH}) reached for: ${dirPath}`);
    return 0;
  }
  
  if (exploredDirectories.has(dirPath)) {
    return 0;
  }
  
  exploredDirectories.add(dirPath);
  
  console.log(`🔍 Exploring directory at depth ${currentDepth}: ${dirPath}`);
  
  try {
    const contents = await getRepositoryContents(dirPath);
    if (!Array.isArray(contents)) {
      console.log(`📄 Single file found: ${dirPath}`);
      return 0;
    }
    
    console.log(`📁 Found ${contents.length} items in directory: ${dirPath}`);
    
    let filesProcessed = 0;
    let subdirectoriesFound = 0;
    
    // Process files first
    for (const item of contents) {
      if (explorationProgress.filesProcessed >= SCANNING_CONFIG.MAX_FILES_TO_SCAN) {
        console.log(`⚠️ Reached maximum file limit, stopping file processing`);
        break;
      }
      
      if (filesProcessed >= SCANNING_CONFIG.MAX_FILES_PER_DIRECTORY) {
        console.log(`⚠️ Reached directory file limit (${SCANNING_CONFIG.MAX_FILES_PER_DIRECTORY}) for: ${dirPath}`);
        break;
      }
      
      if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
        const typedItem = item as { type: string; name: string; path: string };
        
        if (typedItem.type === 'file' && isRelevantFile(typedItem.name, false)) {
          try {
            console.log(`📄 Processing file: ${typedItem.path}`);
            await processFile(typedItem.path, knowledgeBase);
            explorationProgress.filesProcessed++;
            explorationProgress.scannedFiles.push(typedItem.path);
            filesProcessed++;
          } catch (error) {
            console.error(`Error processing file ${typedItem.path}:`, error);
            explorationProgress.connectionErrors.push(`File error: ${error}`);
          }
        } else if (typedItem.type === 'dir') {
          subdirectoriesFound++;
        }
      }
    }
    
    // Then explore subdirectories if we haven't hit limits
    if (explorationProgress.filesProcessed < SCANNING_CONFIG.MAX_FILES_TO_SCAN) {
      for (const item of contents) {
        if (explorationProgress.filesProcessed >= SCANNING_CONFIG.MAX_FILES_TO_SCAN) break;
        
        if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
          const typedItem = item as { type: string; name: string; path: string };
          
          if (typedItem.type === 'dir' && shouldExploreDirectory(typedItem.name, false)) {
            console.log(`📂 Recursing into subdirectory: ${typedItem.name}`);
            const subFiles = await exploreDirectoryRecursively(
              typedItem.path, 
              knowledgeBase, 
              currentDepth + 1, 
              exploredDirectories
            );
            filesProcessed += subFiles;
          }
        }
      }
    }
    
    console.log(`✅ Completed directory: ${dirPath} (processed ${filesProcessed} files, found ${subdirectoriesFound} subdirectories)`);
    return filesProcessed;
  } catch (error) {
    console.error(`Error exploring directory ${dirPath}:`, error);
    explorationProgress.connectionErrors.push(`Directory exploration error: ${error}`);
    return 0;
  }
}

/**
 * Sort directories by importance for better scanning coverage
 */
function sortDirectoriesByImportance(directories: string[]): string[] {
  const importanceScores: { [key: string]: number } = {};
  
  for (const dir of directories) {
    let score = 0;
    
    // High priority patterns
    if (dir.includes('src') || dir.includes('app') || dir.includes('lib')) score += 100;
    if (dir.includes('components') || dir.includes('pages')) score += 90;
    if (dir.includes('services') || dir.includes('api')) score += 80;
    if (dir.includes('config') || dir.includes('settings')) score += 70;
    if (dir.includes('utils') || dir.includes('helpers')) score += 60;
    
    // Framework-specific patterns
    if (dir.includes('ghost') || dir.includes('admin-x')) score += 50;
    if (dir.includes('portal') || dir.includes('membership')) score += 45;
    
    // General patterns
    if (dir.includes('types') || dir.includes('interfaces')) score += 40;
    if (dir.includes('hooks') || dir.includes('context')) score += 35;
    if (dir.includes('store') || dir.includes('state')) score += 30;
    
    // Lower priority
    if (dir.includes('test') || dir.includes('spec')) score += 10;
    if (dir.includes('docs') || dir.includes('documentation')) score += 5;
    
    importanceScores[dir] = score;
  }
  
  return directories.sort((a, b) => importanceScores[b] - importanceScores[a]);
}

/**
 * Enhanced universal file relevance checking
 */
function isRelevantFile(fileName: string, isGhostRepo: boolean): boolean {
  // Skip unimportant files first
  const skipFiles = [
    'package-lock.json', 'yarn.lock', 'bun.lockb', '.gitignore',
    '.env', '.env.local', '.env.example', 'LICENSE', 'CHANGELOG.md',
    '.github/CODE_OF_CONDUCT.md', '.github/CONTRIBUTING.md',
    '.DS_Store', 'Thumbs.db', '.vscode/settings.json'
  ];
  
  if (skipFiles.includes(fileName)) return false;
  
  // Skip GitHub workflow files unless they're important
  if (fileName.includes('.github/workflows/') && !fileName.includes('package.json')) {
    return false;
  }
  
  // Important files regardless of type
  const importantFiles = [
    'package.json', 'README.md', 'tsconfig.json', 'vite.config.ts',
    'vite.config.js', 'next.config.js', 'tailwind.config.js',
    'webpack.config.js', 'rollup.config.js', 'jest.config.js',
    'dockerfile', 'docker-compose.yml', '.env.example'
  ];
  
  if (importantFiles.some(f => fileName.toLowerCase().includes(f.toLowerCase()))) {
    return true;
  }
  
  // Universal relevant extensions
  const relevantExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yaml', '.yml',
    '.vue', '.svelte', '.css', '.scss', '.html', '.xml', '.toml',
    '.ini', '.conf', '.config', '.env'
  ];
  
  return relevantExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

/**
 * Enhanced universal directory exploration logic
 */
function shouldExploreDirectory(dirName: string, isGhostRepo: boolean): boolean {
  // Always skip these directories
  const skipDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    '.vscode', '.idea', 'target', 'out', '.cache', 'tmp', 'temp',
    'test', 'tests', '__tests__', 'spec', '.nyc_output', 'coverage'
  ];
  
  if (skipDirs.includes(dirName)) return false;
  
  // Skip hidden directories
  if (dirName.startsWith('.') && dirName !== '.github') return false;
  
  // Universal important directories
  const importantDirs = [
    'components', 'pages', 'services', 'utils', 'hooks', 'lib', 'api',
    'types', 'store', 'context', 'providers', 'src', 'app', 'routes',
    'controllers', 'models', 'middleware', 'helpers', 'adapters',
    'plugins', 'extensions', 'integrations', 'providers', 'clients',
    'connectors', 'webhooks', 'callbacks', 'handlers', 'processors',
    'validators', 'business', 'domain', 'core', 'features', 'modules',
    'packages', 'apps', 'microservices', 'graphql', 'rest'
  ];
  
  if (importantDirs.includes(dirName)) return true;
  
  // Framework-specific directories
  const frameworkDirs = [
    'layouts', 'templates', 'views', 'screens', 'repositories',
    'entities', 'dto', 'guards', 'decorators', 'filters', 'pipes'
  ];
  
  if (frameworkDirs.includes(dirName)) return true;
  
  // Ghost-specific directories (for backward compatibility)
  if (isGhostRepo) {
    const ghostDirs = [
      'server', 'admin', 'core', 'frontend', 'admin-x-settings',
      'admin-x-activitypub', 'admin-x-design', 'portal', 'signup-form'
    ];
    
    if (ghostDirs.includes(dirName)) return true;
  }
  
  return false;
}

/**
 * Utility function to add delay between API calls
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clear successful path patterns
 */
export function clearSuccessfulPathPatterns(): void {
  successfulPathPatterns.clear();
}

/**
 * Get exploration progress with enhanced information
 */
export function getExplorationProgress(): typeof explorationProgress {
  return { ...explorationProgress };
}

/**
 * Reset exploration progress
 */
export function resetExplorationProgress(): void {
  explorationProgress = {
    pathsAttempted: 0,
    pathsSuccessful: 0,
    filesProcessed: 0,
    status: "idle",
    progress: 0,
    error: null,
    totalAttempts: 0,
    successfulPaths: 0,
    scannedFiles: [],
    repositoryFingerprint: null,
    totalFilesAvailable: 0,
    directoriesExplored: [],
    currentDirectory: "",
    scanStartTime: 0,
    scanDuration: 0,
    rateLimitRemaining: null,
    connectionErrors: []
  };
}

/**
 * Get diagnostic information about the last scan
 */
export function getScanDiagnostics(): {
  scannedFiles: string[];
  pathsSuccessful: number;
  repositoryFingerprint: string | null;
} {
  return {
    scannedFiles: [...explorationProgress.scannedFiles],
    pathsSuccessful: explorationProgress.pathsSuccessful,
    repositoryFingerprint: explorationProgress.repositoryFingerprint
  };
}
