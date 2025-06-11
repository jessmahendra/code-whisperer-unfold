
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
  successfulPaths: 0
};

// Progress update callback
let progressUpdateCallback: ((progress: number) => void) | null = null;

// Common patterns for different types of repositories
const COMMON_REPOSITORY_PATHS = [
  // Root level files
  'package.json',
  'README.md',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  
  // Source directories
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
  
  // Specific source subdirectories
  'src/components',
  'src/pages',
  'src/services',
  'src/utils',
  'src/hooks',
  'src/lib',
  'src/types',
  'app/components',
  'app/pages',
  'app/api',
  'components/ui',
  
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
  
  // Next.js specific
  'app/globals.css',
  'app/layout.tsx',
  'app/page.tsx',
  
  // Common file patterns
  'index.ts',
  'index.tsx',
  'index.js',
  'main.ts',
  'main.tsx',
  'App.tsx',
  'App.ts'
];

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
 * @param {KnowledgeEntry[]} knowledgeBase - Reference to the knowledge base
 * @returns {Promise<boolean>} True if any files were processed successfully
 */
export async function exploreRepositoryPaths(knowledgeBase: KnowledgeEntry[]): Promise<boolean> {
  const repo = getCurrentRepository();
  if (!repo) {
    console.log('No repository configured for path exploration');
    explorationProgress.status = "error";
    explorationProgress.error = "No repository configured";
    return false;
  }

  console.log(`Starting repository exploration for ${repo.owner}/${repo.repo}`);
  
  // Reset progress tracking
  explorationProgress = {
    pathsAttempted: 0,
    pathsSuccessful: 0,
    filesProcessed: 0,
    status: "exploring",
    progress: 0,
    error: null,
    totalAttempts: 0,
    successfulPaths: 0
  };

  let hasProcessedAnyFiles = false;
  const MAX_PATH_ATTEMPTS = 40;
  const MAX_FILES_PER_DIRECTORY = 15;
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
          
          // Process files in this directory
          let filesProcessedInDir = 0;
          for (const item of contents) {
            if (filesProcessedInDir >= MAX_FILES_PER_DIRECTORY) {
              console.log(`Reached file limit for directory ${path}`);
              break;
            }
            
            // Ensure item has the expected properties
            if (item && typeof item === 'object' && 'type' in item && 'name' in item && 'path' in item) {
              if (item.type === 'file') {
                // Process relevant files
                if (isRelevantFile(item.name)) {
                  try {
                    await processFile(item.path, knowledgeBase);
                    hasProcessedAnyFiles = true;
                    explorationProgress.filesProcessed++;
                    filesProcessedInDir++;
                    console.log(`Successfully processed file: ${item.path}`);
                  } catch (error) {
                    console.error(`Error processing file ${item.path}:`, error);
                  }
                }
              } else if (item.type === 'dir' && shouldExploreDirectory(item.name)) {
                // Try to process important subdirectories
                try {
                  await processModule(item.path, knowledgeBase);
                  hasProcessedAnyFiles = true;
                } catch (error) {
                  console.error(`Error processing directory ${item.path}:`, error);
                }
              }
            }
          }
        } else if (contents && typeof contents === 'object' && 'type' in contents && contents.type === 'file') {
          // Single file
          if ('name' in contents && isRelevantFile(contents.name)) {
            try {
              await processFile(path, knowledgeBase);
              hasProcessedAnyFiles = true;
              explorationProgress.filesProcessed++;
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
    
    console.log(`Processed ${explorationProgress.pathsSuccessful} paths successfully out of ${explorationProgress.pathsAttempted} attempts`);
    console.log(`Total files processed: ${explorationProgress.filesProcessed}`);

    return hasProcessedAnyFiles;
  } catch (error) {
    explorationProgress.status = "error";
    explorationProgress.error = error instanceof Error ? error.message : "Unknown error";
    console.error("Error during repository exploration:", error);
    return false;
  }
}

/**
 * Determines if a file is relevant for knowledge extraction
 */
function isRelevantFile(fileName: string): boolean {
  const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.md', '.json'];
  const importantFiles = ['package.json', 'README.md', 'tsconfig.json'];
  
  return importantFiles.includes(fileName) || 
         relevantExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Determines if a directory should be explored
 */
function shouldExploreDirectory(dirName: string): boolean {
  const importantDirs = ['components', 'pages', 'services', 'utils', 'hooks', 'lib', 'api'];
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
  
  return !skipDirs.includes(dirName) && importantDirs.includes(dirName);
}

/**
 * Clear successful path patterns
 */
export function clearSuccessfulPathPatterns(): void {
  successfulPathPatterns.clear();
}

/**
 * Get exploration progress
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
    successfulPaths: 0
  };
}
