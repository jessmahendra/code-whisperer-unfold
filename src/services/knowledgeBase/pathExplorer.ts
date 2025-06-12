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

// Enhanced repository path patterns - start with root exploration
const INITIAL_PATHS = [
  '', // Root directory - most important
  'src',
  'app', 
  'lib',
  'components',
  'pages',
  'utils',
  'services'
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
 * Explores repository paths to find and process files with adaptive scanning
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
  console.log(`Starting adaptive repository exploration for ${repo.owner}/${repo.repo}`);
  
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
  const MAX_FILES_TOTAL = 200; // Increased total file limit
  const MAX_DEPTH = 4;
  
  try {
    // Start with root directory exploration
    console.log('Starting with root directory exploration...');
    const rootSuccess = await exploreDirectoryAdaptively('', knowledgeBase, MAX_FILES_TOTAL, 0, MAX_DEPTH);
    if (rootSuccess) {
      hasProcessedAnyFiles = true;
    }

    // If root exploration didn't find much, try specific paths
    if (explorationProgress.filesProcessed < 10) {
      console.log('Root exploration found few files, trying specific paths...');
      
      for (const path of INITIAL_PATHS.slice(1)) { // Skip empty string since we already did root
        if (explorationProgress.filesProcessed >= MAX_FILES_TOTAL) break;
        
        try {
          const success = await exploreDirectoryAdaptively(path, knowledgeBase, 30, 0, MAX_DEPTH);
          if (success) {
            hasProcessedAnyFiles = true;
          }
        } catch (error) {
          console.log(`Could not explore path ${path}:`, error);
        }
      }
    }

    // Mark as complete
    explorationProgress.status = "complete";
    updateProgress(100);
    
    console.log(`Adaptive scan complete: ${explorationProgress.pathsSuccessful} paths, ${explorationProgress.filesProcessed} files`);
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
 * Adaptive directory exploration that discovers repository structure dynamically
 */
async function exploreDirectoryAdaptively(
  dirPath: string,
  knowledgeBase: KnowledgeEntry[],
  maxFilesRemaining: number,
  currentDepth: number,
  maxDepth: number
): Promise<boolean> {
  if (currentDepth > maxDepth || maxFilesRemaining <= 0) {
    return false;
  }

  console.log(`Exploring directory: "${dirPath}" (depth: ${currentDepth}, remaining: ${maxFilesRemaining})`);
  
  try {
    explorationProgress.pathsAttempted++;
    
    const contents = await getRepositoryContents(dirPath);
    if (!Array.isArray(contents)) {
      // Single file
      if (contents && typeof contents === 'object' && 'type' in contents) {
        const typedContents = contents as { type: string; name?: string; path: string };
        if (typedContents.type === 'file' && typedContents.name && isRelevantFile(typedContents.name)) {
          try {
            await processFile(dirPath, knowledgeBase);
            explorationProgress.filesProcessed++;
            explorationProgress.scannedFiles.push(dirPath);
            successfulPathPatterns.add(dirPath);
            explorationProgress.pathsSuccessful++;
            return true;
          } catch (error) {
            console.error(`Error processing single file ${dirPath}:`, error);
          }
        }
      }
      return false;
    }

    // Directory with multiple items
    if (contents.length === 0) {
      return false;
    }

    console.log(`Found ${contents.length} items in directory: "${dirPath}"`);
    successfulPathPatterns.add(dirPath);
    explorationProgress.pathsSuccessful++;
    
    let filesProcessed = 0;
    let localMaxFiles = Math.min(maxFilesRemaining, 50); // Process up to 50 files per directory
    
    // First pass: process all files in current directory
    for (const item of contents) {
      if (filesProcessed >= localMaxFiles) break;
      
      if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
        const typedItem = item as { type: string; name: string; path: string };
        
        if (typedItem.type === 'file' && isRelevantFile(typedItem.name)) {
          try {
            await processFile(typedItem.path, knowledgeBase);
            explorationProgress.filesProcessed++;
            explorationProgress.scannedFiles.push(typedItem.path);
            filesProcessed++;
            
            // Update progress
            const progress = Math.min(95, (explorationProgress.filesProcessed / 200) * 100);
            updateProgress(progress);
            
            console.log(`Processed file: ${typedItem.path} (${explorationProgress.filesProcessed} total)`);
          } catch (error) {
            console.error(`Error processing file ${typedItem.path}:`, error);
          }
        }
      }
    }

    // Second pass: recurse into promising subdirectories
    const remainingFiles = maxFilesRemaining - filesProcessed;
    if (remainingFiles > 0 && currentDepth < maxDepth) {
      for (const item of contents) {
        if (remainingFiles <= 0) break;
        
        if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
          const typedItem = item as { type: string; name: string; path: string };
          
          if (typedItem.type === 'dir' && shouldExploreDirectory(typedItem.name)) {
            try {
              await exploreDirectoryAdaptively(
                typedItem.path, 
                knowledgeBase, 
                Math.min(remainingFiles, 30), // Allocate files to subdirectory
                currentDepth + 1, 
                maxDepth
              );
            } catch (error) {
              console.error(`Error exploring subdirectory ${typedItem.path}:`, error);
            }
          }
        }
      }
    }

    return filesProcessed > 0;
  } catch (error) {
    console.error(`Error exploring directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * Enhanced file relevance checking - more permissive
 */
function isRelevantFile(fileName: string): boolean {
  // Skip obvious binary and generated files
  const skipExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.mp3', '.wav', '.avi',
    '.zip', '.tar', '.gz', '.rar',
    '.exe', '.bin', '.dll', '.so'
  ];
  
  const skipFiles = [
    'package-lock.json', 'yarn.lock', 'bun.lockb', 'pnpm-lock.yaml',
    '.DS_Store', 'Thumbs.db',
    'node_modules'
  ];
  
  // Check skip conditions
  if (skipFiles.includes(fileName)) return false;
  if (skipExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) return false;
  
  // Include most text-based files
  const relevantExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.svelte', '.angular',
    '.py', '.rb', '.php', '.go', '.rs', '.java', '.cs', '.cpp', '.c',
    '.md', '.mdx', '.txt', '.rst',
    '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config',
    '.css', '.scss', '.sass', '.less', '.styl',
    '.html', '.htm', '.xml', '.xhtml',
    '.sql', '.prisma', '.graphql', '.gql'
  ];
  
  // Important config files (without extension)
  const importantFiles = [
    'README', 'CHANGELOG', 'LICENSE', 'CONTRIBUTING',
    'Dockerfile', 'Makefile', '.gitignore', '.gitattributes',
    'package.json', 'tsconfig.json', 'jsconfig.json',
    'vite.config.ts', 'vite.config.js',
    'next.config.js', 'next.config.ts',
    'tailwind.config.js', 'tailwind.config.ts',
    'eslint.config.js', '.eslintrc.js', '.eslintrc.json',
    'prettier.config.js', '.prettierrc'
  ];
  
  if (importantFiles.some(file => fileName === file || fileName.startsWith(file))) return true;
  if (relevantExtensions.some(ext => fileName.endsWith(ext))) return true;
  
  // Include files without extensions that might be scripts or configs
  if (!fileName.includes('.') && fileName.length > 1) return true;
  
  return false;
}

/**
 * Enhanced directory exploration logic - more permissive
 */
function shouldExploreDirectory(dirName: string): boolean {
  // Skip these directories entirely
  const skipDirs = [
    'node_modules', '.git', '.svn', '.hg',
    'dist', 'build', 'out', 'target',
    '.next', '.nuxt', '.vite', 'coverage',
    '.vscode', '.idea', '.vs',
    'tmp', 'temp', '.cache', 'cache',
    '__pycache__', '.pytest_cache',
    'vendor', 'packages'
  ];
  
  if (skipDirs.includes(dirName)) return false;
  
  // Skip most hidden directories except important ones
  if (dirName.startsWith('.') && !['github', '.storybook', '.vscode'].includes(dirName.substring(1))) {
    return false;
  }
  
  // Otherwise, explore it
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
