import { getRepositoryContents, getCurrentRepository } from '../githubConnector';
import { processFile, processModule } from './fileProcessor';
import { KnowledgeEntry } from './types';

// Track successful path patterns
let successfulPathPatterns: Set<string> = new Set();
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
  skippedFiles: [] as string[],
  directoryStats: {} as Record<string, number>
};

// Progress update callback
let progressUpdateCallback: ((progress: number) => void) | null = null;

// Ghost-specific priority paths for membership/pricing content
const GHOST_PRIORITY_PATHS = [
  // Main README and docs
  'README.md',
  'docs/README.md',
  'CONTRIBUTING.md',
  
  // Core admin interface (likely contains membership logic)
  'ghost/admin/app',
  'ghost/admin/app/components',
  'ghost/admin/app/controllers',
  'ghost/admin/app/models',
  'ghost/admin/app/routes',
  'ghost/admin/app/templates',
  'ghost/admin/app/services',
  
  // Core Ghost application
  'ghost/core/server',
  'ghost/core/server/api',
  'ghost/core/server/models',
  'ghost/core/server/services',
  'ghost/core/server/web',
  'ghost/core/frontend',
  
  // Membership and subscription specific
  'ghost/core/server/services/members',
  'ghost/core/server/services/stripe',
  'ghost/core/server/models/member',
  'ghost/core/server/api/endpoints/members',
  'ghost/admin/app/components/gh-members',
  'ghost/admin/app/controllers/member',
  'ghost/admin/app/routes/member',
  'ghost/admin/app/templates/member',
  
  // Configuration and settings
  'config',
  'ghost/core/server/data/schema',
  'ghost/core/shared/config',
];

const ENHANCED_REPOSITORY_PATHS = [
  // Root level files
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  
  // Ghost core directories
  'ghost',
  'ghost/admin',
  'ghost/core',
  'ghost/core/server',
  'ghost/core/frontend',
  'ghost/core/shared',
  
  // Admin interface
  'ghost/admin/app',
  'ghost/admin/app/adapters',
  'ghost/admin/app/components',
  'ghost/admin/app/controllers',
  'ghost/admin/app/helpers',
  'ghost/admin/app/models',
  'ghost/admin/app/routes',
  'ghost/admin/app/services',
  'ghost/admin/app/templates',
  'ghost/admin/app/utils',
  
  // Server components
  'ghost/core/server/api',
  'ghost/core/server/data',
  'ghost/core/server/models',
  'ghost/core/server/services',
  'ghost/core/server/web',
  
  // Frontend and themes
  'ghost/core/frontend/services',
  'ghost/core/frontend/helpers',
  'content/themes',
  
  // Common app patterns (fallback)
  'src',
  'app',
  'lib',
  'components',
  'services',
  'models',
  'api',
  'admin',
  'public',
  'content',
  'data'
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
 * Enhanced repository exploration with Ghost-specific patterns
 */
export async function exploreRepositoryPaths(knowledgeBase: KnowledgeEntry[]): Promise<boolean> {
  const repo = getCurrentRepository();
  if (!repo) {
    console.log('No repository configured for path exploration');
    explorationProgress.status = "error";
    explorationProgress.error = "No repository configured";
    return false;
  }

  const currentFingerprint = generateRepositoryFingerprint();
  console.log(`🚀 Starting Ghost-optimized repository exploration for ${repo.owner}/${repo.repo}`);
  
  // Reset progress tracking
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
    skippedFiles: [],
    directoryStats: {}
  };

  let hasProcessedAnyFiles = false;
  const MAX_PATH_ATTEMPTS = 200; // Increased for deeper scanning
  const MAX_FILES_PER_DIRECTORY = 100; // Increased for larger directories
  const MAX_RECURSION_DEPTH = 6; // Deeper recursion for Ghost
  
  // Determine if this is a Ghost repository
  const isGhostRepo = repo.repo.toLowerCase().includes('ghost') || repo.owner.toLowerCase().includes('ghost');
  const pathsToExplore = isGhostRepo ? GHOST_PRIORITY_PATHS : ENHANCED_REPOSITORY_PATHS;
  
  console.log(`📊 Detected ${isGhostRepo ? 'Ghost' : 'generic'} repository, using ${pathsToExplore.length} priority paths`);

  try {
    // PHASE 1: Process high-priority paths
    console.log('🎯 Phase 1: Processing priority paths for Ghost content');
    for (let i = 0; i < Math.min(pathsToExplore.length, 50); i++) {
      const path = pathsToExplore[i];
      
      explorationProgress.pathsAttempted++;
      updateProgress(Math.round((i / 50) * 30)); // 30% for priority paths
      
      try {
        console.log(`🔍 Scanning priority path: ${path}`);
        
        const contents = await getRepositoryContents(path);
        
        if (Array.isArray(contents)) {
          console.log(`📁 Found directory with ${contents.length} items: ${path}`);
          successfulPathPatterns.add(path);
          explorationProgress.pathsSuccessful++;
          explorationProgress.directoryStats[path] = contents.length;
          
          // Process files in directory with enhanced logic
          let filesProcessedInDir = 0;
          for (const item of contents.slice(0, MAX_FILES_PER_DIRECTORY)) {
            if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
              const typedItem = item as { type: string; name: string; path: string };
              
              if (typedItem.type === 'file' && isRelevantFileEnhanced(typedItem.name, typedItem.path)) {
                try {
                  await processFile(typedItem.path, knowledgeBase);
                  hasProcessedAnyFiles = true;
                  explorationProgress.filesProcessed++;
                  explorationProgress.scannedFiles.push(typedItem.path);
                  filesProcessedInDir++;
                  console.log(`✅ Priority file processed: ${typedItem.path}`);
                } catch (error) {
                  console.error(`❌ Error processing priority file ${typedItem.path}:`, error);
                }
              } else {
                explorationProgress.skippedFiles.push(typedItem.path);
              }
            }
          }
          
          console.log(`📊 Processed ${filesProcessedInDir} files from ${path}`);
        } else if (contents && typeof contents === 'object' && 'type' in contents) {
          // Single file
          const typedContents = contents as { type: string; name?: string; path: string };
          if (typedContents.type === 'file' && typedContents.name && isRelevantFileEnhanced(typedContents.name, typedContents.path)) {
            try {
              await processFile(path, knowledgeBase);
              hasProcessedAnyFiles = true;
              explorationProgress.filesProcessed++;
              explorationProgress.scannedFiles.push(path);
              successfulPathPatterns.add(path);
              explorationProgress.pathsSuccessful++;
              console.log(`✅ Priority single file processed: ${path}`);
            } catch (error) {
              console.error(`❌ Error processing priority single file ${path}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Priority path not accessible: ${path}`);
      }
    }

    // PHASE 2: Deep recursive exploration of successful paths
    console.log('🔍 Phase 2: Deep exploration of discovered directories');
    const successfulPaths = Array.from(successfulPathPatterns);
    
    for (let i = 0; i < Math.min(successfulPaths.length, 30); i++) {
      const basePath = successfulPaths[i];
      updateProgress(Math.round(30 + ((i / 30) * 40))); // 30-70% for deep exploration
      
      try {
        await exploreDirectoryRecursively(basePath, knowledgeBase, MAX_FILES_PER_DIRECTORY, 1, MAX_RECURSION_DEPTH);
      } catch (error) {
        console.error(`❌ Error in deep exploration of ${basePath}:`, error);
      }
    }

    // PHASE 3: Fallback exploration for additional coverage
    console.log('📂 Phase 3: Fallback exploration for additional coverage');
    const remainingPaths = ENHANCED_REPOSITORY_PATHS.filter(path => !successfulPathPatterns.has(path));
    
    for (let i = 0; i < Math.min(remainingPaths.length, 50) && explorationProgress.pathsAttempted < MAX_PATH_ATTEMPTS; i++) {
      const path = remainingPaths[i];
      explorationProgress.pathsAttempted++;
      updateProgress(Math.round(70 + ((i / 50) * 25))); // 70-95% for fallback
      
      try {
        await explorePathSafely(path, knowledgeBase, MAX_FILES_PER_DIRECTORY);
      } catch (error) {
        console.error(`❌ Error in fallback exploration of ${path}:`, error);
      }
    }

    // Mark as complete
    explorationProgress.status = "complete";
    updateProgress(100);
    
    console.log(`🎉 Enhanced Ghost-optimized scan complete:`);
    console.log(`   📊 ${explorationProgress.pathsSuccessful} successful paths`);
    console.log(`   📄 ${explorationProgress.filesProcessed} files processed`);
    console.log(`   🚫 ${explorationProgress.skippedFiles.length} files skipped`);
    console.log(`   📁 ${Object.keys(explorationProgress.directoryStats).length} directories scanned`);
    
    // Log file type distribution
    const fileTypes = explorationProgress.scannedFiles.reduce((acc, path) => {
      const ext = path.split('.').pop()?.toLowerCase() || 'no-ext';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`   📋 File types:`, fileTypes);

    return hasProcessedAnyFiles;
  } catch (error) {
    explorationProgress.status = "error";
    explorationProgress.error = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error during repository exploration:", error);
    return false;
  }
}

/**
 * Safely explore a single path
 */
async function explorePathSafely(
  path: string,
  knowledgeBase: KnowledgeEntry[],
  maxFiles: number
): Promise<void> {
  try {
    const contents = await getRepositoryContents(path);
    
    if (Array.isArray(contents)) {
      successfulPathPatterns.add(path);
      explorationProgress.pathsSuccessful++;
      explorationProgress.directoryStats[path] = contents.length;
      
      let filesProcessed = 0;
      for (const item of contents.slice(0, maxFiles)) {
        if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
          const typedItem = item as { type: string; name: string; path: string };
          
          if (typedItem.type === 'file' && isRelevantFileEnhanced(typedItem.name, typedItem.path)) {
            try {
              await processFile(typedItem.path, knowledgeBase);
              explorationProgress.filesProcessed++;
              explorationProgress.scannedFiles.push(typedItem.path);
              filesProcessed++;
            } catch (error) {
              console.error(`Error processing file ${typedItem.path}:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    // Path doesn't exist or isn't accessible
  }
}

/**
 * Enhanced recursive directory processing with better depth control
 */
async function exploreDirectoryRecursively(
  dirPath: string, 
  knowledgeBase: KnowledgeEntry[], 
  maxFiles: number, 
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;
  
  try {
    const contents = await getRepositoryContents(dirPath);
    if (!Array.isArray(contents)) return;
    
    let filesProcessed = 0;
    const subdirectories: string[] = [];
    
    // First pass: process files
    for (const item of contents) {
      if (filesProcessed >= maxFiles) break;
      
      if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
        const typedItem = item as { type: string; name: string; path: string };
        
        if (typedItem.type === 'file' && isRelevantFileEnhanced(typedItem.name, typedItem.path)) {
          try {
            await processFile(typedItem.path, knowledgeBase);
            explorationProgress.filesProcessed++;
            explorationProgress.scannedFiles.push(typedItem.path);
            filesProcessed++;
          } catch (error) {
            console.error(`Error in recursive processing of ${typedItem.path}:`, error);
          }
        } else if (typedItem.type === 'dir' && shouldExploreDirectoryEnhanced(typedItem.name, typedItem.path)) {
          subdirectories.push(typedItem.path);
        }
      }
    }
    
    // Second pass: recurse into subdirectories
    for (const subdir of subdirectories.slice(0, 10)) { // Limit subdirectory exploration
      await exploreDirectoryRecursively(subdir, knowledgeBase, Math.floor(maxFiles / 2), currentDepth + 1, maxDepth);
    }
    
  } catch (error) {
    console.error(`Error in recursive directory processing for ${dirPath}:`, error);
  }
}

/**
 * Enhanced file relevance checking with Ghost-specific patterns
 */
function isRelevantFileEnhanced(fileName: string, filePath: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  const lowerFilePath = filePath.toLowerCase();
  
  // Skip common non-relevant files
  const skipFiles = [
    'package-lock.json', 'yarn.lock', 'bun.lockb', '.gitignore',
    '.env', '.env.local', '.env.example', 'node_modules',
    '.git', '.vscode', '.idea', 'coverage', 'dist', 'build'
  ];
  
  if (skipFiles.some(skip => lowerFileName.includes(skip) || lowerFilePath.includes(skip))) {
    return false;
  }
  
  // High priority: README and documentation
  if (lowerFileName === 'readme.md' || lowerFileName === 'readme.txt' || lowerFileName === 'readme') {
    return true;
  }
  
  // High priority: Ghost-specific membership/business logic files
  const ghostPriorityPatterns = [
    'member', 'subscription', 'stripe', 'payment', 'pricing', 'plan',
    'tier', 'portal', 'signup', 'billing', 'checkout'
  ];
  
  if (ghostPriorityPatterns.some(pattern => lowerFilePath.includes(pattern) || lowerFileName.includes(pattern))) {
    return true;
  }
  
  // Relevant file extensions
  const relevantExtensions = [
    '.js', '.ts', '.tsx', '.jsx', '.hbs', '.handlebars',
    '.md', '.json', '.yaml', '.yml', '.css', '.scss',
    '.html', '.vue', '.svelte', '.py', '.rb', '.php'
  ];
  
  // Important configuration files
  const importantFiles = [
    'package.json', 'config.json', 'config.js', 'config.ts',
    'docker-compose.yml', 'dockerfile', 'migration'
  ];
  
  if (importantFiles.some(file => lowerFileName.includes(file))) {
    return true;
  }
  
  return relevantExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Enhanced directory exploration logic with Ghost-specific patterns
 */
function shouldExploreDirectoryEnhanced(dirName: string, dirPath: string): boolean {
  const lowerDirName = dirName.toLowerCase();
  const lowerDirPath = dirPath.toLowerCase();
  
  // Skip directories that are typically not relevant
  const skipDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    '.vscode', '.idea', 'target', 'out', '.cache', 'tmp', 'temp',
    'test', 'tests', '__tests__', 'spec', '.github'
  ];
  
  if (skipDirs.includes(lowerDirName)) return false;
  
  // High priority Ghost directories
  const ghostImportantDirs = [
    'ghost', 'admin', 'core', 'server', 'api', 'models', 'services',
    'members', 'components', 'controllers', 'routes', 'templates',
    'helpers', 'adapters', 'frontend', 'themes', 'content'
  ];
  
  if (ghostImportantDirs.some(dir => lowerDirPath.includes(dir) || lowerDirName === dir)) {
    return true;
  }
  
  // Standard important directories
  const importantDirs = [
    'src', 'app', 'lib', 'components', 'pages', 'utils', 'hooks',
    'types', 'store', 'context', 'providers', 'config', 'data',
    'database', 'db', 'schemas', 'migrations', 'public', 'assets'
  ];
  
  if (importantDirs.includes(lowerDirName)) return true;
  
  // Skip hidden directories
  if (dirName.startsWith('.') || dirName.startsWith('_')) return false;
  
  return true;
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
    skippedFiles: [],
    directoryStats: {}
  };
}

/**
 * Get diagnostic information about the last scan
 */
export function getScanDiagnostics(): {
  scannedFiles: string[];
  pathsSuccessful: number;
  repositoryFingerprint: string | null;
  skippedFiles: string[];
  directoryStats: Record<string, number>;
} {
  return {
    scannedFiles: [...explorationProgress.scannedFiles],
    pathsSuccessful: explorationProgress.pathsSuccessful,
    repositoryFingerprint: explorationProgress.repositoryFingerprint,
    skippedFiles: [...explorationProgress.skippedFiles],
    directoryStats: { ...explorationProgress.directoryStats }
  };
}
