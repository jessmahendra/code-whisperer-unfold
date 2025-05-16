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

// Error tracking for repository operations
let lastErrorMessage: string | null = null;
let connectionAttempts = 0;
const MAX_ERROR_DISPLAY_COUNT = 3;

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
      
      console.log(`Fetching repo contents: ${owner}/${repo}/${repoPath}`);
      
      const contents = await fetchRepositoryContents(owner, repo, repoPath);
      
      // Reset error state on successful call
      lastErrorMessage = null;
      connectionAttempts = 0;
      
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
        console.warn(`Path not found in repository: ${repoPath}`, errorObj);
        lastErrorMessage = `Path not found: ${repoPath}`;
      } else if (errorObj.status === 401 || errorObj.status === 403) {
        console.error(`Authorization error (${errorObj.status}): ${errorObj.message}`, errorObj);
        lastErrorMessage = `Authorization error: ${errorObj.message || 'Invalid token or insufficient permissions'}`;
        
        // Show toast only for the first few authorization errors to avoid spamming
        if (connectionAttempts < MAX_ERROR_DISPLAY_COUNT) {
          toast.error(`GitHub authentication failed: ${errorObj.message || 'Check your token permissions'}`, {
            description: "Make sure your token has 'repo' scope and is valid",
            duration: 5000
          });
          connectionAttempts++;
        }
      } else {
        console.warn(`Failed to fetch from GitHub API (${errorObj.status || 'unknown error'}), falling back to mock data: ${errorObj.message || errorObj}`);
        lastErrorMessage = `GitHub API error: ${errorObj.message || 'Unknown error'}`;
        connectionAttempts++;
      }
      
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
 * Gets the last error message from GitHub operations
 * @returns {string|null} Last error message or null if no errors
 */
export function getLastErrorMessage(): string | null {
  return lastErrorMessage;
}

/**
 * Reset error tracking
 */
export function resetErrorTracking(): void {
  lastErrorMessage = null;
  connectionAttempts = 0;
}

/**
 * Gets diagnostic information for GitHub connection
 * @returns {object} Connection diagnostic information
 */
export function getConnectionDiagnostics(): {
  initialized: boolean;
  configured: boolean;
  errorMessage: string | null;
  connectionAttempts: number;
} {
  const config = getRepositoryConfig();
  
  return {
    initialized: isGithubClientInitialized(),
    configured: !!config,
    errorMessage: lastErrorMessage,
    connectionAttempts
  };
}
