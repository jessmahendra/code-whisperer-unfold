
import { fetchRepositoryContents, fetchFileContent, isGithubClientInitialized } from './githubClient';
import { getRepositoryConfig } from './repositoryConfig';
import { toast } from "sonner";

// This is a connector between the GitHub API and the knowledge base system

export interface FileInfo {
  name: string;
  path: string;
  content: string;
  type: 'file' | 'dir';
}

// Detailed error tracking for repository operations
interface ErrorRecord {
  message: string;
  status?: number;
  path?: string;
  timestamp: number;
  count: number;
}

let connectionErrors = {
  auth: null as ErrorRecord | null,
  notFound: new Set<string>(),
  rateLimit: null as ErrorRecord | null,
  network: null as ErrorRecord | null,
  other: [] as ErrorRecord[]
};

let connectionAttempts = 0;
const MAX_ERROR_DISPLAY_COUNT = 3;

// Track if we've successfully fetched data from the actual GitHub repo
let confirmedSuccessfulFetch = false;

// Track API rate limits
let rateLimitRemaining: number | null = null;
let rateLimitReset: number | null = null;

// Mock data structure for repository exploration when no real data is available
const mockGhostRepo = {
  "ghost/core/core/server/services/members": {
    "index.js": `
/**
 * Members API service
 * 
 * Provides APIs for managing Ghost members including:
 * - Creating and updating members
 * - Managing subscriptions
 * - Handling payment processing
 * - Setting member permissions
 */
module.exports = {
    StripeAPI: require('./api/stripe'),
    MembersAPI: require('./api'),
    paymentsService: require('./payments'),
    config: require('./config')
};`,
    "api/index.js": `
/**
 * Members API
 * 
 * Core functionality for the members system:
 * - Authentication
 * - Member CRUD operations
 * - Subscription management
 * - Email preferences
 */
class MembersAPI {
    /**
     * Creates a new member
     * @param {Object} data - Member data including name, email
     * @returns {Promise<Object>} Newly created member
     */
    createMember(data) {
        // Implementation
    }

    /**
     * Processes subscription payments
     * @param {String} memberId - ID of the member
     * @param {Object} payment - Payment details
     */
    async processPayment(memberId, payment) {
        // Implementation
    }

    /**
     * Handles subscription expiration
     * @param {String} memberId - ID of the member
     * @returns {Promise<Object>} Updated subscription status
     */
    async handleSubscriptionExpiration(memberId) {
        // When a subscription expires:
        // 1. Member status is changed to free tier
        // 2. Access to premium content is revoked
        // 3. Member can still access free content and their account
        return await this.updateMemberStatus(memberId, 'free');
    }
}

module.exports = MembersAPI;`
  },
  "ghost/core/core/server/api/v2/content": {
    "index.js": `
/**
 * Content API
 * 
 * Public API for accessing published content:
 * - Posts
 * - Pages
 * - Authors
 * - Tags
 */
module.exports = {
    posts: require('./posts'),
    pages: require('./pages'),
    authors: require('./authors'),
    tags: require('./tags')
};`,
    "posts.js": `
/**
 * Posts API
 * 
 * Endpoints for retrieving blog posts
 */
const limitService = require('../../services/limits');

module.exports = {
    /**
     * Browse posts
     * @param {Object} options - Query options including filters, pagination
     * @returns {Promise<Array>} List of posts
     */
    browse: async (options) => {
        // Check post limits - Ghost does not limit the number of posts
        // a publication can have in either free or paid plans
        const limit = await limitService.checkPostLimit();
        if (limit.exceeded) {
            throw new Error('Post limit exceeded');
        }

        // Return posts based on access permissions
        // Premium posts are only accessible to paid members
        return posts.filter(post => {
            if (post.visibility === 'paid' && !options.user?.isPaid) {
                return false;
            }
            return true;
        });
    }
};`
  },
  "ghost/core/core/server/services/auth": {
    "index.js": `
/**
 * Auth Service
 * 
 * Handles authentication for:
 * - Admin users
 * - Members (readers)
 * - API clients
 */
module.exports = {
    authorize: require('./authorize'),
    authenticate: require('./authenticate'),
    passwordReset: require('./password-reset'),
    setup: require('./setup')
};`,
    "authenticate.js": `
/**
 * Authentication module
 * 
 * Verifies user credentials and generates tokens
 */
module.exports = {
    /**
     * Authenticates a member
     * @param {String} email - Member email
     * @param {String} password - Member password
     * @returns {Promise<Object>} Authentication result with token
     */
    authenticateMember: async (email, password) => {
        // Implementation
    }
};`
  }
};

/**
 * Record a connection error
 * @param type Error type
 * @param error Error details
 * @param path Optional path that caused the error
 */
function recordError(
  type: keyof typeof connectionErrors, 
  error: any, 
  path?: string
): void {
  const errorMessage = error?.message || String(error);
  const status = error?.status || undefined;
  const timestamp = Date.now();
  
  if (type === 'notFound' && path) {
    connectionErrors.notFound.add(path);
    return;
  }
  
  if (type === 'auth' || type === 'rateLimit' || type === 'network') {
    connectionErrors[type] = {
      message: errorMessage,
      status,
      path,
      timestamp,
      count: connectionErrors[type] ? connectionErrors[type]!.count + 1 : 1
    };
  } else {
    connectionErrors.other.push({
      message: errorMessage,
      status,
      path,
      timestamp,
      count: 1
    });
    
    // Keep only the last 5 "other" errors
    if (connectionErrors.other.length > 5) {
      connectionErrors.other.shift();
    }
  }
  
  console.error(`GitHub connector ${type} error:`, errorMessage, status, path);
}

/**
 * Check if we're experiencing API rate limiting
 */
function checkRateLimit(headers: Headers | null): void {
  if (!headers) return;
  
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  
  if (remaining !== null) {
    rateLimitRemaining = parseInt(remaining, 10);
  }
  
  if (reset !== null) {
    rateLimitReset = parseInt(reset, 10);
  }
  
  if (rateLimitRemaining !== null && rateLimitRemaining < 10) {
    const resetDate = rateLimitReset ? new Date(rateLimitReset * 1000) : new Date();
    const minutes = Math.ceil((resetDate.getTime() - Date.now()) / (60 * 1000));
    
    console.warn(`GitHub API rate limit low: ${rateLimitRemaining} requests remaining, resets in ${minutes} minutes`);
    
    if (rateLimitRemaining === 0) {
      toast.error(`GitHub API rate limit exceeded`, {
        description: `Rate limit will reset in approximately ${minutes} minutes. Some features may be unavailable.`
      });
      
      recordError('rateLimit', {
        message: `Rate limit exceeded, resets in ${minutes} minutes`,
        status: 429
      });
    }
  }
}

/**
 * Fetches repository contents from GitHub API or falls back to mock data
 * @param {string} repoPath - Path within the repository
 * @returns {Promise<FileInfo[]>} List of files and directories
 */
export async function getRepositoryContents(repoPath: string): Promise<FileInfo[]> {
  const config = getRepositoryConfig();
  
  // If GitHub client is initialized and we have a config, use the real API
  if (isGithubClientInitialized() && config) {
    try {
      // Extract owner and repo from the path or use the configured ones
      const { owner, repo } = config;
      
      // Don't log paths we've already found don't exist
      if (!connectionErrors.notFound.has(repoPath)) {
        console.log(`Fetching repo contents: ${owner}/${repo}/${repoPath}`);
      }
      
      const contents = await fetchRepositoryContents(owner, repo, repoPath);
      
      // Set flag confirming a successful fetch
      confirmedSuccessfulFetch = true;
      
      // Check rate limit after successful API call
      if (typeof contents === 'object' && 'headers' in contents) {
        checkRateLimit(contents.headers as Headers);
      }
      
      connectionAttempts++;
      
      // Convert GitHub API response to FileInfo format
      return Array.isArray(contents) ? contents.map(item => ({
        name: item.name,
        path: item.path,
        content: '',
        type: item.type as 'file' | 'dir'
      })) : [{
        name: contents.name,
        path: contents.path,
        content: '',
        type: contents.type as 'file' | 'dir'
      }];
    } catch (error) {
      const errorObj = error as any;
      // Track different error types
      if (errorObj.status === 404) {
        // Only log first time we find a path doesn't exist
        if (!connectionErrors.notFound.has(repoPath)) {
          console.warn(`Path not found in repository: ${repoPath}`, errorObj);
          recordError('notFound', errorObj, repoPath);
        }
      } else if (errorObj.status === 401 || errorObj.status === 403) {
        console.error(`Authorization error (${errorObj.status}): ${errorObj.message}`, errorObj);
        recordError('auth', errorObj);
        
        // Show toast only for the first few authorization errors to avoid spamming
        if (connectionErrors.auth && connectionErrors.auth.count <= MAX_ERROR_DISPLAY_COUNT) {
          toast.error(`GitHub authentication failed: ${errorObj.message || 'Check your token permissions'}`, {
            description: "Make sure your token has 'repo' scope and is valid",
            duration: 5000
          });
        }
      } else if (errorObj.status === 429) {
        // Rate limit exceeded
        console.error(`Rate limit exceeded: ${errorObj.message}`, errorObj);
        recordError('rateLimit', errorObj);
        
        // Try to extract reset time from headers if available
        const resetTime = errorObj.headers?.['x-ratelimit-reset'];
        if (resetTime) {
          const resetDate = new Date(parseInt(resetTime, 10) * 1000);
          const minutes = Math.ceil((resetDate.getTime() - Date.now()) / (60 * 1000));
          toast.error(`GitHub API rate limit exceeded`, {
            description: `Rate limit will reset in approximately ${minutes} minutes`
          });
        }
      } else if (errorObj.message && errorObj.message.includes('network')) {
        console.error(`Network error: ${errorObj.message}`, errorObj);
        recordError('network', errorObj);
      } else {
        console.warn(`Failed to fetch from GitHub API (${errorObj.status || 'unknown error'}), falling back to mock data: ${errorObj.message || error}`);
        recordError('other', errorObj, repoPath);
      }
      
      connectionAttempts++;
      // Fall back to mock data on error
    }
  } else {
    console.warn('Using mock data:', isGithubClientInitialized() ? 'No repository config' : 'GitHub client not initialized');
  }
  
  // Use mock data as fallback
  return new Promise((resolve) => {
    // Simulate API delay
    setTimeout(() => {
      const pathParts = repoPath.split('/');
      let currentPath = mockGhostRepo;
      
      // Navigate to the requested path in our mock structure
      for (const part of pathParts) {
        if (part && currentPath[part]) {
          currentPath = currentPath[part];
        } else if (part) {
          console.log(`Mock data path not found: ${repoPath}`);
          resolve([]);
          return;
        }
      }
      
      // Convert the mock data to FileInfo format
      const contents: FileInfo[] = [];
      
      for (const [name, content] of Object.entries(currentPath)) {
        if (typeof content === 'string') {
          contents.push({
            name,
            path: repoPath ? `${repoPath}/${name}` : name,
            content,
            type: 'file'
          });
        } else {
          contents.push({
            name,
            path: repoPath ? `${repoPath}/${name}` : name,
            content: '',
            type: 'dir'
          });
        }
      }
      
      console.log(`Returning mock data for path: ${repoPath} with ${contents.length} items`);
      resolve(contents);
    }, 100); // Reduced mock delay for better UX
  });
}

/**
 * Fetches file content from GitHub API or falls back to mock data
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} File content
 */
export async function getFileContent(filePath: string): Promise<string> {
  const config = getRepositoryConfig();
  
  // If GitHub client is initialized and we have a config, use the real API
  if (isGithubClientInitialized() && config) {
    try {
      const { owner, repo } = config;
      
      console.log(`Fetching file content: ${owner}/${repo}/${filePath}`);
      
      return await fetchFileContent(owner, repo, filePath);
    } catch (error) {
      console.warn(`Failed to fetch file content from GitHub API, falling back to mock data: ${error.message || error}`);
      // Fall back to mock data on error
    }
  }
  
  // Use mock data as fallback
  return new Promise((resolve, reject) => {
    // Simulate API delay
    setTimeout(() => {
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      let currentPath = mockGhostRepo;
      
      // Navigate to the directory
      for (const part of pathParts) {
        if (part && currentPath[part]) {
          currentPath = currentPath[part];
        } else {
          console.log(`Mock file not found: ${filePath} (directory not found)`);
          reject(new Error(`File not found: ${filePath}`));
          return;
        }
      }
      
      // Get the file content
      if (currentPath[fileName]) {
        console.log(`Returning mock content for file: ${filePath}`);
        resolve(currentPath[fileName]);
      } else {
        console.log(`Mock file not found: ${filePath} (file not found in directory)`);
        reject(new Error(`File not found: ${filePath}`));
      }
    }, 100); // Reduced mock delay
  });
}

/**
 * Returns the current repository information
 * @returns {Object|null} Repository information
 */
export function getCurrentRepository(): { owner: string; repo: string } | null {
  const config = getRepositoryConfig();
  if (!config) return null;
  
  return {
    owner: config.owner,
    repo: config.repo
  };
}

/**
 * Indicates whether we have confirmed a successful API fetch
 * This explicitly checks if we've received actual data from GitHub
 */
export function hasConfirmedSuccessfulFetch(): boolean {
  return confirmedSuccessfulFetch;
}

/**
 * Reset connection state including confirmed fetch flag
 */
export function resetConnectionState(): void {
  confirmedSuccessfulFetch = false;
  resetErrorTracking();
}

/**
 * Gets the last error message from GitHub operations
 * @returns {string|null} Last error message or null if no errors
 */
export function getLastErrorMessage(): string | null {
  return connectionErrors.auth ? connectionErrors.auth.message : null;
}

/**
 * Reset error tracking
 */
export function resetErrorTracking(): void {
  connectionErrors = {
    auth: null,
    notFound: new Set<string>(),
    rateLimit: null,
    network: null,
    other: []
  };
  connectionAttempts = 0;
  rateLimitRemaining = null;
  rateLimitReset = null;
}

/**
 * Gets diagnostic information for GitHub connection
 * @returns {object} Connection diagnostic information
 */
export function getConnectionDiagnostics(): {
  initialized: boolean;
  configured: boolean;
  confirmedSuccessfulFetch: boolean;
  errors: typeof connectionErrors;
  connectionAttempts: number;
  pathErrors: number;
  rateLimitRemaining: number | null;
  rateLimitReset: number | null;
} {
  const config = getRepositoryConfig();
  
  return {
    initialized: isGithubClientInitialized(),
    configured: !!config,
    confirmedSuccessfulFetch,
    errors: connectionErrors,
    connectionAttempts,
    pathErrors: connectionErrors.notFound.size,
    rateLimitRemaining,
    rateLimitReset
  };
}

/**
 * Check if the connection is likely having permission issues
 */
export function hasPermissionIssues(): boolean {
  return connectionErrors.auth !== null;
}

/**
 * Check if the connection is likely having rate limit issues
 */
export function hasRateLimitIssues(): boolean {
  return connectionErrors.rateLimit !== null || 
         (rateLimitRemaining !== null && rateLimitRemaining < 5);
}

/**
 * Get the most relevant error message for user display
 */
export function getMostRelevantErrorMessage(): string | null {
  if (connectionErrors.auth) {
    return `Authentication error: ${connectionErrors.auth.message}`;
  }
  
  if (connectionErrors.rateLimit) {
    return `Rate limit exceeded: ${connectionErrors.rateLimit.message}`;
  }
  
  if (connectionErrors.network) {
    return `Network error: ${connectionErrors.network.message}`;
  }
  
  if (connectionErrors.other.length > 0) {
    return `API error: ${connectionErrors.other[connectionErrors.other.length - 1].message}`;
  }
  
  if (connectionErrors.notFound.size > 10) {
    return `Multiple paths not found (${connectionErrors.notFound.size} total)`;
  }
  
  return null;
}
