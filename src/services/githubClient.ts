
import { Octokit } from "@octokit/rest";
import { toast } from "sonner";

// Singleton instance for the GitHub client
let octokitInstance: Octokit | null = null;

/**
 * Initialize the GitHub client with a personal access token
 * @param token GitHub personal access token (classic or fine-grained)
 * @returns Boolean indicating if initialization was successful
 */
export function initGithubClient(token: string): boolean {
  try {
    // Clear any previous instance
    octokitInstance = null;
    
    // Create a new Octokit instance with the token
    octokitInstance = new Octokit({
      auth: token
    });
    
    console.log("GitHub client initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize GitHub client:", error);
    toast.error("Failed to initialize GitHub client", {
      description: error instanceof Error ? error.message : "Unknown error occurred"
    });
    return false;
  }
}

/**
 * Check if the GitHub client is initialized
 * @returns Boolean indicating if client is ready
 */
export function isGithubClientInitialized(): boolean {
  return octokitInstance !== null;
}

/**
 * Clear the current GitHub client instance
 */
export function clearGithubClient(): void {
  octokitInstance = null;
}

/**
 * Get repository contents from GitHub API
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path within the repository
 * @returns Repository contents
 */
export async function fetchRepositoryContents(owner: string, repo: string, path: string = "") {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    console.log(`Fetching repository contents for ${owner}/${repo}/${path}`);
    
    const response = await octokitInstance.repos.getContent({
      owner,
      repo,
      path
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching repository contents for ${owner}/${repo}/${path}:`, error);
    throw error;
  }
}

/**
 * Get file content from GitHub API
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path to the file
 * @returns File content as a string
 */
export async function fetchFileContent(owner: string, repo: string, path: string) {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    console.log(`Fetching file content for ${owner}/${repo}/${path}`);
    
    const response = await octokitInstance.repos.getContent({
      owner,
      repo,
      path
    });

    // GitHub returns an array if path is a directory, or an object if it's a file
    if (Array.isArray(response.data)) {
      throw new Error(`Path ${path} is a directory, not a file`);
    }

    // Type assertion to access the content property
    const fileData = response.data as { content?: string; encoding?: string };
    
    if (!fileData.content) {
      throw new Error(`No content found for file ${path}`);
    }

    // GitHub API returns content as base64
    // Use browser-compatible base64 decoding
    try {
      // Remove whitespace and line breaks from the base64 string
      const cleanBase64 = fileData.content.replace(/\s/g, '');
      
      // Decode base64 string using browser-compatible approach
      const binary = atob(cleanBase64);
      
      // Handle Unicode characters properly
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
      }
      
      // Convert bytes to string using TextDecoder
      return new TextDecoder('utf-8').decode(bytes);
    } catch (decodeError) {
      console.error("Failed to decode file content:", decodeError);
      throw new Error(`Failed to decode content for ${path}: ${decodeError.message}`);
    }
  } catch (error) {
    console.error(`Error fetching file content for ${owner}/${repo}/${path}:`, error);
    throw error;
  }
}

/**
 * Get commit history for a file
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path to the file
 * @param limit Maximum number of commits to return
 * @returns Array of commit information
 */
export async function fetchCommitHistory(owner: string, repo: string, path: string, limit: number = 10) {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    const response = await octokitInstance.repos.listCommits({
      owner,
      repo,
      path,
      per_page: limit
    });

    return response.data.map(item => ({
      sha: item.sha,
      date: item.commit.author?.date || new Date().toISOString(),
      message: item.commit.message,
      author: item.commit.author?.name || 'Unknown',
      authorEmail: item.commit.author?.email || undefined
    }));
  } catch (error) {
    console.error(`Error fetching commit history for ${owner}/${repo}/${path}:`, error);
    throw error;
  }
}

/**
 * Get the most recent author information for a file
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path to the file
 * @returns Author information (name and email)
 */
export async function fetchFileAuthor(owner: string, repo: string, path: string) {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    const commits = await fetchCommitHistory(owner, repo, path, 1);
    
    if (commits && commits.length > 0) {
      return {
        name: commits[0].author,
        email: commits[0].authorEmail
      };
    }
    
    return {
      name: undefined,
      email: undefined
    };
  } catch (error) {
    console.error(`Error fetching author for ${owner}/${repo}/${path}:`, error);
    // Return undefined instead of throwing to prevent errors from blocking rendering
    return {
      name: undefined,
      email: undefined
    };
  }
}

/**
 * Validate GitHub token by attempting to get the authenticated user
 * @param token GitHub personal access token to validate (classic or fine-grained)
 * @returns User information if valid, null otherwise
 */
export async function validateGithubToken(token: string) {
  try {
    console.log("Validating GitHub token...");
    const tempClient = new Octokit({ auth: token });
    const response = await tempClient.users.getAuthenticated();
    
    // Check if this is a fine-grained token by looking at the scopes
    try {
      const rateLimit = await tempClient.rateLimit.get();
      console.log("Token validation successful:", response.data.login);
      console.log("Rate limit info:", rateLimit.data.rate);
      
      // Fine-grained tokens typically have different rate limit structures
      const isFineGrained = rateLimit.data.rate.limit > 5000 || response.data.type === 'User';
      if (isFineGrained) {
        console.log("Detected fine-grained personal access token");
      } else {
        console.log("Detected classic personal access token");
      }
    } catch (rateLimitError) {
      console.log("Could not fetch rate limit info, proceeding with validation");
    }
    
    return response.data;
  } catch (error) {
    console.error("Token validation failed:", error);
    
    // Provide more specific error messages for common issues
    let errorMessage = "Make sure your token is valid and has the required permissions.";
    
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        errorMessage = "Invalid token. Please check your GitHub token.";
      } else if (error.message.includes('403')) {
        errorMessage = "Token doesn't have sufficient permissions. Ensure it has 'Contents' and 'Metadata' repository permissions.";
      } else if (error.message.includes('404')) {
        errorMessage = "Repository not found or token doesn't have access to it.";
      }
    }
    
    toast.error("Invalid GitHub token", {
      description: errorMessage
    });
    return null;
  }
}
