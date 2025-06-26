import { Octokit } from "@octokit/rest";
import { toast } from "sonner";

// Replace with your GitHub OAuth App Client ID
const GITHUB_CLIENT_ID = "YOUR_CLIENT_ID_HERE";
const GITHUB_REDIRECT_URI = window.location.origin;
const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

const TOKEN_KEY = "github_oauth_token";
const USER_KEY = "github_oauth_user";
const REPOS_KEY = "github_oauth_repos";

// Type definitions
export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  type: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  updated_at: string;
  default_branch: string;
  owner: {
    login: string;
    type: string;
  };
}

export interface GitHubAuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
  repositories: GitHubRepository[];
  isLoading: boolean;
  error: string | null;
}

// --- PKCE helpers ---
function base64urlencode(str: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlencode(array.buffer);
}
export async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlencode(digest);
}
function generateState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
}

// --- OAuth Flow ---
export async function initiateGitHubOAuth() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  sessionStorage.setItem("github_pkce_verifier", codeVerifier);
  sessionStorage.setItem("github_oauth_state", state);
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: "repo read:user user:email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    allow_signup: "true"
  });
  window.location.href = `${GITHUB_AUTH_URL}?${params}`;
}

export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return false;
  if (state !== sessionStorage.getItem("github_oauth_state")) {
    toast.error("OAuth state mismatch. Please try again.");
    return false;
  }
  const codeVerifier = sessionStorage.getItem("github_pkce_verifier");
  if (!codeVerifier) {
    toast.error("Missing PKCE verifier. Please try again.");
    return false;
  }
  // Exchange code for token
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: GITHUB_REDIRECT_URI
    })
  });
  const data = await res.json();
  if (!data.access_token) {
    toast.error("GitHub authentication failed");
    return false;
  }
  localStorage.setItem(TOKEN_KEY, data.access_token);
  sessionStorage.removeItem("github_pkce_verifier");
  sessionStorage.removeItem("github_oauth_state");
  // Clean up URL
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function logoutGitHub() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REPOS_KEY);
  toast.success("Logged out of GitHub");
}

// --- GitHub API ---
export async function fetchGitHubUser(token: string): Promise<GitHubUser | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const user = await res.json();
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}
export async function fetchUserRepositories(token: string): Promise<GitHubRepository[]> {
  const res = await fetch("https://api.github.com/user/repos?per_page=100", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];
  const repos = await res.json();
  localStorage.setItem(REPOS_KEY, JSON.stringify(repos));
  return repos;
}
export function getStoredUser(): GitHubUser | null {
  const str = localStorage.getItem(USER_KEY);
  return str ? JSON.parse(str) : null;
}
export function getStoredRepos(): GitHubRepository[] {
  const str = localStorage.getItem(REPOS_KEY);
  return str ? JSON.parse(str) : [];
}
export async function validateStoredToken() {
  const token = getStoredToken();
  if (!token) return false;
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok;
}

/**
 * Get current authentication state
 */
export function getGitHubAuthState(): GitHubAuthState {
  const token = getStoredToken();
  const user = getStoredUser();
  const repositories = getStoredRepos();

  return {
    isAuthenticated: !!token,
    user,
    token,
    repositories,
    isLoading: false,
    error: null,
  };
}

/**
 * Initialize GitHub client with OAuth token
 */
export function initGitHubClientWithOAuth(): boolean {
  const token = getStoredToken();
  if (!token) {
    return false;
  }

  try {
    // Initialize Octokit client
    const octokit = new Octokit({
      auth: token,
    });

    // Store in global scope for other services to use
    (window as { githubOctokit?: Octokit }).githubOctokit = octokit;
    
    console.log('GitHub client initialized with OAuth token');
    return true;
  } catch (error) {
    console.error('Failed to initialize GitHub client:', error);
    return false;
  }
}

/**
 * Check if OAuth callback is in progress
 */
export function isOAuthCallback(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('code') && urlParams.has('state');
}

/**
 * Refresh user repositories
 */
export async function refreshUserRepositories(): Promise<GitHubRepository[]> {
  const token = getStoredToken();
  if (!token) {
    return [];
  }

  try {
    const repos = await fetchUserRepositories(token);
    return repos;
  } catch (error) {
    console.error('Failed to refresh repositories:', error);
    return [];
  }
} 