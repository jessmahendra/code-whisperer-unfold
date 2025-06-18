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
  repositoryFingerprint: null as string | null
};

// Progress update callback
let progressUpdateCallback: ((progress: number) => void) | null = null;

// Ghost-specific repository paths for comprehensive scanning
const GHOST_SPECIFIC_PATHS = [
  // Core Ghost application
  'ghost/core',
  'ghost/core/core',
  'ghost/core/core/server',
  'ghost/core/core/server/services',
  'ghost/core/core/server/services/members',
  'ghost/core/core/server/api',
  'ghost/core/core/server/models',
  'ghost/core/core/server/data',
  'ghost/core/core/frontend',
  
  // Admin interface
  'ghost/admin',
  'ghost/admin/app',
  'ghost/admin/app/services',
  'ghost/admin/app/models',
  'ghost/admin/app/controllers',
  
  // Admin-X applications
  'apps/admin-x-settings',
  'apps/admin-x-activitypub',
  'apps/admin-x-design',
  'apps/admin-x-framework',
  
  // Portal and membership
  'apps/portal',
  'apps/portal/src',
  'apps/signup-form',
  'apps/comments-ui',
  
  // API and services
  'ghost/core/core/server/api/endpoints',
  'ghost/core/core/server/services/auth',
  'ghost/core/core/server/services/mail',
  'ghost/core/core/server/services/themes',
  'ghost/core/core/server/services/settings',
  
  // Content and themes
  'ghost/core/core/server/services/posts',
  'ghost/core/core/server/services/pages',
  'ghost/core/core/frontend/services',
  
  // Database and migrations
  'ghost/core/core/server/data/migrations',
  'ghost/core/core/server/data/schema',
  
  // Configuration files
  'ghost/core/core/server/config',
  'package.json',
  'apps/portal/package.json',
  'ghost/admin/package.json'
];

// General paths for non-Ghost repositories
const GENERAL_REPOSITORY_PATHS = [
  'src',
  'app',
  'lib',
  'components',
  'pages',
  'services',
  'utils',
  'api',
  'package.json',
  'README.md'
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
 * Explores repository paths to find and process files
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
  console.log(`Starting Ghost-aware repository exploration for ${repo.owner}/${repo.repo}`);
  
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
    repositoryFingerprint: currentFingerprint
  };

  let hasProcessedAnyFiles = false;
  
  // Determine if this is a Ghost repository
  const isGhostRepo = repo.repo.toLowerCase().includes('ghost') || repo.owner.toLowerCase().includes('ghost');
  const pathsToTry = isGhostRepo ? GHOST_SPECIFIC_PATHS : GENERAL_REPOSITORY_PATHS;
  
  console.log(`Detected ${isGhostRepo ? 'Ghost' : 'general'} repository, using ${pathsToTry.length} specialized paths`);

  try {
    // Try each path pattern
    for (let i = 0; i < pathsToTry.length; i++) {
      const path = pathsToTry[i];
      
      explorationProgress.pathsAttempted++;
      explorationProgress.totalAttempts = explorationProgress.pathsAttempted;
      
      // Update progress
      const progress = Math.round((i / pathsToTry.length) * 100);
      updateProgress(progress);
      
      try {
        console.log(`Scanning path: ${path}`);
        
        const contents = await getRepositoryContents(path);
        
        if (Array.isArray(contents)) {
          console.log(`Found ${contents.length} items in ${path}`);
          successfulPathPatterns.add(path);
          explorationProgress.pathsSuccessful++;
          explorationProgress.successfulPaths = explorationProgress.pathsSuccessful;
          
          // Process files in this directory
          let filesProcessedInDir = 0;
          const maxFilesPerDir = isGhostRepo ? 100 : 50; // Higher limit for Ghost repos
          
          for (const item of contents) {
            if (filesProcessedInDir >= maxFilesPerDir) {
              console.log(`Reached file limit for directory ${path}`);
              break;
            }
            
            if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
              const typedItem = item as { type: string; name: string; path: string };
              
              if (typedItem.type === 'file') {
                if (isRelevantFile(typedItem.name, isGhostRepo)) {
                  try {
                    console.log(`Processing file: ${typedItem.path}`);
                    await processFile(typedItem.path, knowledgeBase);
                    hasProcessedAnyFiles = true;
                    explorationProgress.filesProcessed++;
                    explorationProgress.scannedFiles.push(typedItem.path);
                    filesProcessedInDir++;
                  } catch (error) {
                    console.error(`Error processing file ${typedItem.path}:`, error);
                  }
                }
              } else if (typedItem.type === 'dir' && shouldExploreDirectory(typedItem.name, isGhostRepo)) {
                // Recursive directory processing for important subdirectories
                try {
                  await processDirectoryRecursively(typedItem.path, knowledgeBase, 25, 1, isGhostRepo);
                  hasProcessedAnyFiles = true;
                } catch (error) {
                  console.error(`Error processing directory ${typedItem.path}:`, error);
                }
              }
            }
          }
        } else if (contents && typeof contents === 'object' && 'type' in contents) {
          // Single file
          const typedContents = contents as { type: string; name?: string; path: string };
          if (typedContents.type === 'file' && typedContents.name && isRelevantFile(typedContents.name, isGhostRepo)) {
            try {
              console.log(`Processing single file: ${path}`);
              await processFile(path, knowledgeBase);
              hasProcessedAnyFiles = true;
              explorationProgress.filesProcessed++;
              explorationProgress.scannedFiles.push(path);
              successfulPathPatterns.add(path);
              explorationProgress.pathsSuccessful++;
              explorationProgress.successfulPaths = explorationProgress.pathsSuccessful;
            } catch (error) {
              console.error(`Error processing single file ${path}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error exploring path ${path}:`, error);
        // Continue to next path
      }
    }

    // Mark as complete
    explorationProgress.status = "complete";
    updateProgress(100);
    
    console.log(`Repository scan complete: ${explorationProgress.pathsSuccessful} paths, ${explorationProgress.filesProcessed} files`);
    console.log(`Sample scanned files:`, explorationProgress.scannedFiles.slice(0, 10));

    return hasProcessedAnyFiles;
  } catch (error) {
    explorationProgress.status = "error";
    explorationProgress.error = error instanceof Error ? error.message : "Unknown error";
    console.error("Error during repository exploration:", error);
    return false;
  }
}

/**
 * Recursive directory processing
 */
async function processDirectoryRecursively(
  dirPath: string, 
  knowledgeBase: KnowledgeEntry[], 
  maxFiles: number, 
  currentDepth: number,
  isGhostRepo: boolean
): Promise<void> {
  if (currentDepth > 3) return; // Limit recursion depth
  
  try {
    const contents = await getRepositoryContents(dirPath);
    if (!Array.isArray(contents)) return;
    
    let filesProcessed = 0;
    for (const item of contents) {
      if (filesProcessed >= maxFiles) break;
      
      if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
        const typedItem = item as { type: string; name: string; path: string };
        
        if (typedItem.type === 'file' && isRelevantFile(typedItem.name, isGhostRepo)) {
          try {
            await processFile(typedItem.path, knowledgeBase);
            explorationProgress.filesProcessed++;
            explorationProgress.scannedFiles.push(typedItem.path);
            filesProcessed++;
          } catch (error) {
            console.error(`Error in recursive processing of ${typedItem.path}:`, error);
          }
        } else if (typedItem.type === 'dir' && shouldExploreDirectory(typedItem.name, isGhostRepo)) {
          await processDirectoryRecursively(typedItem.path, knowledgeBase, Math.floor(maxFiles / 2), currentDepth + 1, isGhostRepo);
        }
      }
    }
  } catch (error) {
    console.error(`Error in recursive directory processing for ${dirPath}:`, error);
  }
}

/**
 * Enhanced file relevance checking with Ghost-specific logic
 */
function isRelevantFile(fileName: string, isGhostRepo: boolean): boolean {
  // Skip unimportant files first
  const skipFiles = [
    'package-lock.json', 'yarn.lock', 'bun.lockb', '.gitignore',
    '.env', '.env.local', '.env.example', 'LICENSE', 'CHANGELOG.md',
    '.github/CODE_OF_CONDUCT.md', '.github/CONTRIBUTING.md'
  ];
  
  if (skipFiles.includes(fileName)) return false;
  
  // Skip GitHub workflow and script files unless they're important
  if (fileName.includes('.github/') && !fileName.includes('package.json')) {
    return false;
  }
  
  // Important files regardless of type
  const importantFiles = [
    'package.json', 'README.md', 'tsconfig.json', 'vite.config.ts',
    'vite.config.js', 'next.config.js', 'tailwind.config.js'
  ];
  
  if (importantFiles.includes(fileName)) return true;
  
  if (isGhostRepo) {
    // Ghost-specific important files
    const ghostImportantFiles = [
      'index.js', 'app.js', 'server.js', 'boot.js', 'config.js',
      'routes.js', 'members.js', 'auth.js', 'mail.js', 'posts.js',
      'pages.js', 'settings.js', 'themes.js', 'api.js'
    ];
    
    if (ghostImportantFiles.some(f => fileName.includes(f))) return true;
    
    // Ghost file extensions
    const ghostExtensions = [
      '.js', '.ts', '.tsx', '.jsx', '.hbs', '.json', '.yaml', '.yml'
    ];
    
    return ghostExtensions.some(ext => fileName.endsWith(ext));
  } else {
    // General relevant extensions
    const relevantExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yaml', '.yml',
      '.vue', '.svelte', '.css', '.scss', '.html'
    ];
    
    return relevantExtensions.some(ext => fileName.endsWith(ext));
  }
}

/**
 * Enhanced directory exploration logic with Ghost-specific priorities
 */
function shouldExploreDirectory(dirName: string, isGhostRepo: boolean): boolean {
  // Always skip these directories
  const skipDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    '.vscode', '.idea', 'target', 'out', '.cache', 'tmp', 'temp',
    'test', 'tests', '__tests__', 'spec'
  ];
  
  if (skipDirs.includes(dirName)) return false;
  
  if (isGhostRepo) {
    // Ghost-specific important directories
    const ghostImportantDirs = [
      'server', 'services', 'api', 'models', 'data', 'frontend',
      'admin', 'core', 'app', 'src', 'lib', 'utils', 'controllers',
      'middleware', 'routes', 'themes', 'helpers', 'adapters'
    ];
    
    if (ghostImportantDirs.includes(dirName)) return true;
  } else {
    // General important directories
    const importantDirs = [
      'components', 'pages', 'services', 'utils', 'hooks', 'lib', 'api',
      'types', 'store', 'context', 'providers', 'src', 'app'
    ];
    
    if (importantDirs.includes(dirName)) return true;
  }
  
  // Skip hidden directories
  if (dirName.startsWith('.') || dirName.startsWith('_')) return false;
  
  return false; // Be more restrictive to focus on important directories
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
    repositoryFingerprint: null
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
