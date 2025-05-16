
import { getRepositoryContents, getCurrentRepository, getFileContent } from '../githubConnector';
import { KnowledgeEntry } from './types';
import { processModule, processFile } from './fileProcessor';
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

// Tracks successful path patterns for future reference
let successfulPathPatterns: string[] = [];
// Track exploration progress
let explorationProgress = {
  totalAttempts: 0,
  successfulPaths: 0,
  progress: 0,
  status: "idle" as "idle" | "exploring" | "complete" | "error",
  error: null as string | null,
  onProgressUpdate: null as ((progress: number) => void) | null
};

/**
 * Sets a callback for progress updates
 * @param callback Function to call with progress updates
 */
export function setProgressUpdateCallback(callback: (progress: number) => void): void {
  explorationProgress.onProgressUpdate = callback;
}

/**
 * Gets the current exploration progress
 * @returns Current progress object
 */
export function getExplorationProgress(): typeof explorationProgress {
  return { ...explorationProgress };
}

/**
 * Updates exploration progress and triggers callback
 * @param value New progress value (0-100)
 */
function updateProgress(value: number): void {
  explorationProgress.progress = Math.min(Math.max(0, value), 100);
  if (explorationProgress.onProgressUpdate) {
    explorationProgress.onProgressUpdate(explorationProgress.progress);
  }
}

/**
 * Gets the default paths to try for a repository structure
 * @param {string|undefined} repoName - Repository name
 * @returns {string[]} Array of paths to try
 */
export function getDefaultPathsToTry(repoName?: string): string[] {
  // For Ghost specifically, try these paths for current repository structure
  if (repoName === 'Ghost') {
    return [
      '', // Root directory
      'ghost',
      
      // Most current Ghost 5.x+ paths - these are most likely to work
      'ghost/core',
      'ghost/admin',
      'ghost/core/core',
      'ghost/core/core/server',
      'ghost/core/core/server/api',
      'ghost/core/core/server/services',
      'ghost/core/core/server/services/members',
      'ghost/core/core/server/services/auth',
      'ghost/core/core/server/models',
      
      // More specific paths for services and API endpoints
      'ghost/core/core/server/api/canary',
      'ghost/core/core/server/api/canary/endpoints',
      'ghost/core/core/server/api/v3',
      'ghost/core/core/server/services/settings',
      'ghost/core/core/server/services/url',
      'ghost/core/core/server/services/mail',
      
      // Some specific areas known to be important
      'ghost/core/core/server/data/schema',
      'ghost/core/core/server/web',
      'ghost/core/core/shared',
      'ghost/admin/app',
      
      // Fallback to older paths
      'core',
      'packages',
      'apps',
      'content',
      'docs',
    ];
  }
  
  // Basic repository structure for any repo
  const basePaths = [
    '', // Root directory
    'src',
    'app',
    'packages',
    'lib',
    'core',
    
    // Common code organization patterns
    'src/api',
    'src/services',
    'src/models',
    'src/components',
    'api',
    'services',
    'models',
    'controllers',
    'utils',
    'helpers',
    
    // Common folder names for specific features
    'src/auth',
    'src/users',
    'src/content',
    'auth',
    'users',
    'content',
  ];

  // Add repo name prefix paths if a repo name is provided
  if (repoName) {
    return [
      ...basePaths,
      `${repoName}/src`,
      `${repoName}/app`,
      `${repoName}/packages`,
      `${repoName}/core`
    ];
  }
  
  return basePaths;
}

/**
 * Explores repository paths to find and process files
 * @param {KnowledgeEntry[]} knowledgeBase - Reference to the knowledge base
 * @returns {Promise<boolean>} True if any files were processed
 */
export async function exploreRepositoryPaths(
  knowledgeBase: KnowledgeEntry[]
): Promise<boolean> {
  try {
    // Reset and initialize exploration progress
    explorationProgress = {
      totalAttempts: 0,
      successfulPaths: 0,
      progress: 0,
      status: "exploring",
      error: null,
      onProgressUpdate: explorationProgress.onProgressUpdate
    };
    updateProgress(5); // Start at 5%
    
    // Get current repository configuration
    const currentRepo = getCurrentRepository();
    
    if (!currentRepo) {
      console.log('No repository configuration found, using mock data');
      explorationProgress.status = "error";
      explorationProgress.error = "No repository configuration found";
      updateProgress(100);
      return false;
    }
    
    console.log(`Exploring repository: ${currentRepo.owner}/${currentRepo.repo}`);
    
    // First, try to get the root contents to better understand the repository structure
    let rootContents = [];
    try {
      updateProgress(10);
      toast.loading("Exploring repository structure...", { duration: 3000 });
      rootContents = await getRepositoryContents('');
      console.log(`Found ${rootContents.length} items in the root of the repository:`, 
        rootContents.map(item => item.name).join(', '));
        
      if (rootContents.length > 0) {
        updateProgress(20);
        // Check if this is a monorepo by looking for directories like "ghost" or "core" or "packages"
        const mainDirs = rootContents
          .filter(item => item.type === 'dir')
          .map(dir => dir.path);
          
        if (mainDirs.length > 0) {
          console.log(`Discovered directories: ${mainDirs.join(', ')}`);
          successfulPathPatterns.push(...mainDirs);
          
          // If it's a GitHub monorepo, first try to explore those main dirs
          let dirCounter = 0;
          for (const dir of mainDirs) {
            try {
              // Update progress as we process directories
              updateProgress(20 + Math.floor((dirCounter / mainDirs.length) * 30));
              dirCounter++;
              
              console.log(`Exploring main directory: ${dir}`);
              const dirContents = await getRepositoryContents(dir);
              if (dirContents.length > 0) {
                console.log(`Found ${dirContents.length} items in ${dir} directory`);
                // Add subdirectories to successful patterns
                const subDirs = dirContents
                  .filter(item => item.type === 'dir')
                  .map(subDir => `${dir}/${subDir.name}`);
                  
                if (subDirs.length > 0) {
                  console.log(`Adding subdirectories: ${subDirs.join(', ')}`);
                  successfulPathPatterns.push(...subDirs);
                  
                  // For Ghost, try to go one level deeper since structure is complex
                  if (currentRepo.repo === "Ghost") {
                    let subDirCounter = 0;
                    for (const subDir of subDirs) {
                      updateProgress(50 + Math.floor((subDirCounter / subDirs.length) * 10));
                      subDirCounter++;
                      
                      try {
                        const subContents = await getRepositoryContents(subDir);
                        const subSubDirs = subContents
                          .filter(item => item.type === 'dir')
                          .map(subSubDir => `${subDir}/${subSubDir.name}`);
                        
                        if (subSubDirs.length > 0) {
                          console.log(`Adding nested subdirectories: ${subSubDirs.join(', ')}`);
                          successfulPathPatterns.push(...subSubDirs);
                        }
                      } catch (error) {
                        console.log(`Error exploring subdirectory ${subDir}:`, error.message);
                      }
                    }
                  }
                }
                
                // Process JS/TS files in this directory
                const files = dirContents.filter(item => 
                  item.type === 'file' && 
                  (item.name.endsWith('.js') || 
                   item.name.endsWith('.ts') || 
                   item.name.endsWith('.tsx') || 
                   item.name.endsWith('.jsx') ||
                   item.name.endsWith('.md'))
                );
                
                for (const file of files) {
                  await processFile(file.path, knowledgeBase);
                  explorationProgress.successfulPaths++;
                }
                
                if (files.length > 0) {
                  console.log(`Processed ${files.length} files in ${dir} directory`);
                }
              }
            } catch (error) {
              console.log(`Error exploring ${dir} directory:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error exploring root directory:', error);
      updateProgress(30); // Continue despite error
    }
    
    updateProgress(60);
    
    // Special handling for Ghost repo - use updated paths based on current Ghost structure
    if (currentRepo.repo === "Ghost" && currentRepo.owner === "TryGhost") {
      console.log("Using specialized path exploration for Ghost repository");
      toast.loading("Exploring Ghost code structure...", { duration: 3000 });
      
      // Try the most current Ghost paths directly
      const ghostSpecificPaths = [
        // Current structure (Ghost 5.x+)
        'ghost/core/core/server/services/members',
        'ghost/core/core/server/services/auth',
        'ghost/core/core/server/api/canary/content',
        'ghost/core/core/server/api/canary/endpoints',
        'ghost/core/core/server/models',
        'ghost/core/core/frontend/services',
        'ghost/core/core/server/data/schema',
        'ghost/core/core/server/data/migrations',
        'ghost/admin/app/routes',
        'ghost/admin/app/components',
        'ghost/admin/app/templates'
      ];
      
      let ghostPathCounter = 0;
      for (const path of ghostSpecificPaths) {
        updateProgress(60 + Math.floor((ghostPathCounter / ghostSpecificPaths.length) * 20));
        ghostPathCounter++;
        
        try {
          console.log(`Trying Ghost-specific path: ${path}`);
          const contents = await getRepositoryContents(path);
          
          if (contents && contents.length > 0) {
            console.log(`Found ${contents.length} items in Ghost-specific path: ${path}`);
            successfulPathPatterns.push(path);
            
            // Process JavaScript/TypeScript files in this directory
            const files = contents.filter(item => 
              item.type === 'file' && 
              (item.name.endsWith('.js') || item.name.endsWith('.ts'))
            );
            
            for (const file of files) {
              try {
                await processFile(file.path, knowledgeBase);
                explorationProgress.successfulPaths++;
              } catch (fileError) {
                console.log(`Could not process Ghost file ${file.path}: ${fileError.message}`);
              }
            }
            
            if (files.length > 0) {
              console.log(`Processed ${files.length} files in Ghost-specific path: ${path}`);
            }
          } else {
            console.log(`No contents found for ${path}`);
          }
        } catch (error) {
          console.log(`Could not access Ghost-specific path ${path}: ${error.message}`);
        }
      }
    }
    
    updateProgress(80);
    toast.loading("Finalizing repository exploration...", { duration: 3000 });
    
    // Get paths to try (use discovered paths first, then fall back to defaults)
    const defaultPaths = getDefaultPathsToTry(currentRepo.repo);
    const allPathsToTry = [...new Set([...successfulPathPatterns, ...defaultPaths])];
    
    console.log(`Attempting to scan ${allPathsToTry.length} possible paths in repository structure`);
    
    let processedAny = false;
    let successfulPaths = 0;
    const maxPathsToTry = currentRepo.repo === "Ghost" ? 30 : 20; // Higher limit for Ghost repo
    let attemptedPaths = 0;
    
    for (const path of allPathsToTry) {
      updateProgress(80 + Math.floor((attemptedPaths / maxPathsToTry) * 20));
      
      if (attemptedPaths >= maxPathsToTry) {
        console.log(`Reached maximum path attempt limit (${maxPathsToTry})`);
        break;
      }
      
      attemptedPaths++;
      explorationProgress.totalAttempts++;
      
      try {
        console.log(`Trying path: ${path}`);
        const contents = await getRepositoryContents(path);
        
        if (contents.length > 0) {
          console.log(`Found ${contents.length} items in path: ${path}`);
          
          // Process discovered files and directories
          for (const item of contents) {
            if (item.type === 'file' && (
              item.name.endsWith('.js') || 
              item.name.endsWith('.ts') || 
              item.name.endsWith('.tsx') || 
              item.name.endsWith('.jsx') ||
              item.name.endsWith('.md')  // Include markdown files for documentation
            )) {
              try {
                // Try to load file content first to verify access
                await getFileContent(item.path);
                await processFile(item.path, knowledgeBase);
                processedAny = true;
                successfulPaths++;
                explorationProgress.successfulPaths++;
              } catch (fileError) {
                console.log(`Could not process file ${item.path}: ${fileError.message}`);
              }
            } else if (item.type === 'dir') {
              // Save successful paths for future reference
              if (!successfulPathPatterns.includes(path)) {
                successfulPathPatterns.push(path);
              }
              
              // Process important-looking directories or all directories if we haven't found much yet
              const isImportantDir = 
                item.name.includes('api') || 
                item.name.includes('service') || 
                item.name.includes('controller') ||
                item.name.includes('model') ||
                item.name.includes('util') ||
                item.name.includes('helper') ||
                item.name.includes('component') ||
                item.name.includes('module') ||
                successfulPaths < 5; // Process more aggressively if we haven't found much yet
                
              if (isImportantDir) {
                try {
                  await processModule(item.path, knowledgeBase);
                  processedAny = true;
                  successfulPaths++;
                  explorationProgress.successfulPaths++;
                } catch (dirError) {
                  console.log(`Could not process directory ${item.path}: ${dirError.message}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`Could not access path ${path}: ${error.message}`);
        // Continue trying other paths
      }
    }
    
    updateProgress(100);
    explorationProgress.status = processedAny ? "complete" : "error";
    if (!processedAny) {
      explorationProgress.error = "Could not process any repository paths";
    }
    
    console.log(`Processed ${successfulPaths} paths successfully out of ${attemptedPaths} attempts`);
    return processedAny;
  } catch (error) {
    console.error('Error exploring repository paths:', error);
    explorationProgress.status = "error";
    explorationProgress.error = error instanceof Error ? error.message : "Unknown error occurred";
    updateProgress(100);
    return false;
  }
}

/**
 * Clears the successful path patterns
 */
export function clearSuccessfulPathPatterns(): void {
  successfulPathPatterns = [];
}

/**
 * Reset the exploration progress
 */
export function resetExplorationProgress(): void {
  explorationProgress = {
    totalAttempts: 0,
    successfulPaths: 0,
    progress: 0,
    status: "idle",
    error: null,
    onProgressUpdate: null
  };
}

