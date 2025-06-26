interface RepositoryConfig {
  owner: string;
  repo: string;
  token: string;
  paths?: string[];
  lastAccessed: string;
}

// Local storage key for repository configuration
const REPO_CONFIG_KEY = 'unfold_repo_config';

// Safe JSON serialization to handle circular references
function safeStringify(obj: unknown): string {
  try {
    if (obj === null || obj === undefined) return '';
    if (typeof obj !== 'object') return String(obj);
    
    const seen = new WeakSet();
    
    function safeStringifyHelper(obj: unknown): unknown {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      
      if (seen.has(obj as object)) return '[Circular Reference]';
      seen.add(obj as object);
      
      try {
        if (Array.isArray(obj)) {
          return obj.map(item => safeStringifyHelper(item));
        } else {
          const result: Record<string, unknown> = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              // Skip problematic properties
              if (key === 'frontmatter' && typeof (obj as Record<string, unknown>)[key] === 'object') {
                result[key] = '[Frontmatter Object]';
              } else {
                result[key] = safeStringifyHelper((obj as Record<string, unknown>)[key]);
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
    
    return JSON.stringify(safeStringifyHelper(obj));
  } catch (error) {
    console.error('Safe JSON stringify failed:', error);
    return '{}';
  }
}

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
    localStorage.setItem(REPO_CONFIG_KEY, safeStringify(fullConfig));
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
