
interface RepositoryConfig {
  owner: string;
  repo: string;
  token: string;
  paths?: string[];
  lastAccessed: string;
}

// Local storage key for repository configuration
const REPO_CONFIG_KEY = 'unfold_repo_config';

/**
 * Save repository configuration to local storage
 * @param config Repository configuration to save
 */
export function saveRepositoryConfig(config: Omit<RepositoryConfig, 'lastAccessed'>): void {
  const fullConfig: RepositoryConfig = {
    ...config,
    lastAccessed: new Date().toISOString()
  };
  
  try {
    localStorage.setItem(REPO_CONFIG_KEY, JSON.stringify(fullConfig));
  } catch (error) {
    console.error('Error saving repository configuration:', error);
  }
}

/**
 * Get repository configuration from local storage
 * @returns Repository configuration or null if not found
 */
export function getRepositoryConfig(): RepositoryConfig | null {
  try {
    const configString = localStorage.getItem(REPO_CONFIG_KEY);
    if (!configString) return null;
    
    return JSON.parse(configString) as RepositoryConfig;
  } catch (error) {
    console.error('Error retrieving repository configuration:', error);
    return null;
  }
}

/**
 * Clear repository configuration from local storage
 */
export function clearRepositoryConfig(): void {
  try {
    localStorage.removeItem(REPO_CONFIG_KEY);
  } catch (error) {
    console.error('Error clearing repository configuration:', error);
  }
}

/**
 * Check if repository configuration exists
 * @returns Boolean indicating if configuration exists
 */
export function hasRepositoryConfig(): boolean {
  return getRepositoryConfig() !== null;
}
