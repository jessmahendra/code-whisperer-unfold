
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
  if (!config.owner || !config.repo || !config.token) {
    console.error('Invalid repository configuration: missing required fields');
    throw new Error('Repository configuration requires owner, repo, and token');
  }
  
  const fullConfig: RepositoryConfig = {
    ...config,
    lastAccessed: new Date().toISOString()
  };
  
  try {
    localStorage.setItem(REPO_CONFIG_KEY, JSON.stringify(fullConfig));
    console.log('Repository configuration saved successfully:', config.owner, config.repo);
    // Ensure we didn't save an empty token
    if (!config.token) {
      console.warn('Saved repository config with empty token - connection may fail');
    }
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
    
    const config = JSON.parse(configString) as RepositoryConfig;
    
    // Validate config has required fields
    if (!config.owner || !config.repo || !config.token) {
      console.warn('Retrieved incomplete repository configuration');
    }
    
    return config;
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
    console.log('Repository configuration cleared successfully');
  } catch (error) {
    console.error('Error clearing repository configuration:', error);
  }
}

/**
 * Check if repository configuration exists
 * @returns Boolean indicating if configuration exists
 */
export function hasRepositoryConfig(): boolean {
  const config = getRepositoryConfig();
  return config !== null && Boolean(config.owner) && Boolean(config.repo) && Boolean(config.token);
}
