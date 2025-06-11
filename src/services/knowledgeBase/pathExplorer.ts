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

// Enhanced repository path patterns for better scanning
const COMMON_REPOSITORY_PATHS = [
  // Root level files
  'package.json',
  'README.md',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  
  // Main source directories
  'src',
  'app',
  'lib',
  'components',
  'pages',
  'routes',
  'utils',
  'services',
  'hooks',
  'types',
  'api',
  'config',
  'store',
  'context',
  'providers',
  
  // Specific source subdirectories
  'src/components',
  'src/pages',
  'src/services',
  'src/utils',
  'src/hooks',
  'src/lib',
  'src/types',
  'src/api',
  'src/store',
  'src/context',
  'src/providers',
  'app/components',
  'app/pages',
  'app/api',
  'components/ui',
  'lib/utils',
  
  // Configuration and build files
  'public',
  'dist',
  'build',
  '.github',
  'docs',
  'test',
  'tests',
  '__tests__',
  'spec',
  
  // Style directories
  'styles',
  'css',
  'scss',
  'assets',
  'static',
  
  // Next.js specific
  'app/globals.css',
  'app/layout.tsx',
  'app/page.tsx',
  'pages/_app.tsx',
  'pages/index.tsx',
  
  // Common file patterns
  'index.ts',
  'index.tsx',
  'index.js',
  'main.ts',
  'main.tsx',
  'App.tsx',
  'App.ts',
  
  // Database and backend patterns
  'models',
  'controllers',
  'middleware',
  'database',
  'db',
  'schemas',
  'migrations'
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
 * Explores repository paths to find and process files with enhanced scanning
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
  console.log(`Starting enhanced repository exploration for ${repo.owner}/${repo.repo}`);
  
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
  const MAX_PATH_ATTEMPTS = 100; // Increased from 40
  const MAX_FILES_PER_DIRECTORY = 50; // Increased from 15
  const MAX_RECURSION_DEPTH = 4; // For recursive exploration
  const totalPaths = Math.min(COMMON_REPOSITORY_PATHS.length, MAX_PATH_ATTEMPTS);

  try {
    // Try each common path pattern
    for (let i = 0; i < COMMON_REPOSITORY_PATHS.length && i < MAX_PATH_ATTEMPTS; i++) {
      const path = COMMON_REPOSITORY_PATHS[i];
      
      explorationProgress.pathsAttempted++;
      explorationProgress.totalAttempts = explorationProgress.pathsAttempted;
      
      // Update progress
      const progress = Math.round((i / totalPaths) * 100);
      updateProgress(progress);
      
      try {
        console.log(`Trying path: ${path}`);
        
        const contents = await getRepositoryContents(path);
        
        if (Array.isArray(contents)) {
          console.log(`Found ${contents.length} items in path: ${path}`);
          successfulPathPatterns.add(path);
          explorationProgress.pathsSuccessful++;
          explorationProgress.successfulPaths = explorationProgress.pathsSuccessful;
          
          // Process files in this directory with enhanced logic
          let filesProcessedInDir = 0;
          for (const item of contents) {
            if (filesProcessedInDir >= MAX_FILES_PER_DIRECTORY) {
              console.log(`Reached file limit for directory ${path}`);
              break;
            }
            
            // Enhanced type checking and processing
            if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
              const typedItem = item as { type: string; name: string; path: string };
              
              if (typedItem.type === 'file') {
                // Process relevant files with enhanced filtering
                if (isRelevantFile(typedItem.name)) {
                  try {
                    await processFile(typedItem.path, knowledgeBase);
                    hasProcessedAnyFiles = true;
                    explorationProgress.filesProcessed++;
                    explorationProgress.scannedFiles.push(typedItem.path);
                    filesProcessedInDir++;
                    console.log(`Successfully processed file: ${typedItem.path}`);
                  } catch (error) {
                    console.error(`Error processing file ${typedItem.path}:`, error);
                  }
                }
              } else if (typedItem.type === 'dir' && shouldExploreDirectory(typedItem.name)) {
                // Enhanced recursive directory processing
                try {
                  const dirDepth = typedItem.path.split('/').length;
                  if (dirDepth <= MAX_RECURSION_DEPTH) {
                    await processDirectoryRecursively(typedItem.path, knowledgeBase, MAX_FILES_PER_DIRECTORY, dirDepth);
                    hasProcessedAnyFiles = true;
                  }
                } catch (error) {
                  console.error(`Error processing directory ${typedItem.path}:`, error);
                }
              }
            }
          }
        } else if (contents && typeof contents === 'object' && 'type' in contents) {
          // Single file - fix the TypeScript error
          const typedContents = contents as { type: string; name?: string; path: string };
          if (typedContents.type === 'file' && typedContents.name && isRelevantFile(typedContents.name)) {
            try {
              await processFile(path, knowledgeBase);
              hasProcessedAnyFiles = true;
              explorationProgress.filesProcessed++;
              explorationProgress.scannedFiles.push(path);
              successfulPathPatterns.add(path);
              explorationProgress.pathsSuccessful++;
              explorationProgress.successfulPaths = explorationProgress.pathsSuccessful;
              console.log(`Successfully processed single file: ${path}`);
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
    
    console.log(`Enhanced scan complete: ${explorationProgress.pathsSuccessful} paths, ${explorationProgress.filesProcessed} files`);
    console.log(`Scanned files:`, explorationProgress.scannedFiles.slice(0, 10)); // Log first 10 for debugging

    return hasProcessedAnyFiles;
  } catch (error) {
    explorationProgress.status = "error";
    explorationProgress.error = error instanceof Error ? error.message : "Unknown error";
    console.error("Error during repository exploration:", error);
    return false;
  }
}

/**
 * Enhanced recursive directory processing
 */
async function processDirectoryRecursively(
  dirPath: string, 
  knowledgeBase: KnowledgeEntry[], 
  maxFiles: number, 
  currentDepth: number
): Promise<void> {
  if (currentDepth > 4) return; // Safety limit
  
  try {
    const contents = await getRepositoryContents(dirPath);
    if (!Array.isArray(contents)) return;
    
    let filesProcessed = 0;
    for (const item of contents) {
      if (filesProcessed >= maxFiles) break;
      
      if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
        const typedItem = item as { type: string; name: string; path: string };
        
        if (typedItem.type === 'file' && isRelevantFile(typedItem.name)) {
          try {
            await processFile(typedItem.path, knowledgeBase);
            explorationProgress.filesProcessed++;
            explorationProgress.scannedFiles.push(typedItem.path);
            filesProcessed++;
          } catch (error) {
            console.error(`Error in recursive processing of ${typedItem.path}:`, error);
          }
        } else if (typedItem.type === 'dir' && shouldExploreDirectory(typedItem.name)) {
          await processDirectoryRecursively(typedItem.path, knowledgeBase, Math.floor(maxFiles / 2), currentDepth + 1);
        }
      }
    }
  } catch (error) {
    console.error(`Error in recursive directory processing for ${dirPath}:`, error);
  }
}

/**
 * Enhanced file relevance checking
 */
function isRelevantFile(fileName: string): boolean {
  const relevantExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yaml', '.yml',
    '.vue', '.svelte', '.py', '.rb', '.php', '.go', '.rs', '.java',
    '.css', '.scss', '.sass', '.less', '.html', '.xml'
  ];
  
  const importantFiles = [
    'package.json', 'README.md', 'tsconfig.json', 'vite.config.ts',
    'vite.config.js', 'next.config.js', 'tailwind.config.js',
    'tailwind.config.ts', 'docker-compose.yml', 'Dockerfile'
  ];
  
  const skipFiles = [
    'package-lock.json', 'yarn.lock', 'bun.lockb', '.gitignore',
    '.env', '.env.local', '.env.example'
  ];
  
  if (skipFiles.includes(fileName)) return false;
  if (importantFiles.includes(fileName)) return true;
  
  return relevantExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Enhanced directory exploration logic
 */
function shouldExploreDirectory(dirName: string): boolean {
  const importantDirs = [
    'components', 'pages', 'services', 'utils', 'hooks', 'lib', 'api',
    'types', 'store', 'context', 'providers', 'models', 'controllers',
    'middleware', 'database', 'db', 'schemas', 'routes', 'views'
  ];
  
  const skipDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    '.vscode', '.idea', 'target', 'out', '.cache', 'tmp', 'temp'
  ];
  
  if (skipDirs.includes(dirName)) return false;
  if (importantDirs.includes(dirName)) return true;
  
  // Skip hidden directories and common build artifacts
  if (dirName.startsWith('.') || dirName.startsWith('_')) return false;
  
  return true; // Be more permissive for directory exploration
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
