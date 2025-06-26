import { getActiveRepository } from './userRepositories';

// Cache duration: 2 weeks in milliseconds
const SCAN_CACHE_DURATION = 14 * 24 * 60 * 60 * 1000;

interface ScanCache {
  repositoryId: string;
  lastScanTime: number;
  scanData: any; // Store the knowledge base data
  version: string; // For cache invalidation if needed
}

const SCAN_CACHE_KEY = 'unfold_scan_cache';
const CACHE_VERSION = '1.0';

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
 * Get cached scan data for a repository
 */
export function getCachedScanData(repositoryId: string): ScanCache | null {
  try {
    const cacheString = localStorage.getItem(`${SCAN_CACHE_KEY}_${repositoryId}`);
    if (!cacheString) return null;
    
    const cache: ScanCache = JSON.parse(cacheString);
    
    // Check if cache is valid (not expired and correct version)
    const now = Date.now();
    const isExpired = (now - cache.lastScanTime) > SCAN_CACHE_DURATION;
    const isValidVersion = cache.version === CACHE_VERSION;
    
    if (isExpired || !isValidVersion) {
      // Remove expired or invalid cache
      localStorage.removeItem(`${SCAN_CACHE_KEY}_${repositoryId}`);
      return null;
    }
    
    return cache;
  } catch (error) {
    console.error('Error reading scan cache:', error);
    return null;
  }
}

/**
 * Save scan data to cache
 */
export function saveScanDataToCache(repositoryId: string, scanData: any): boolean {
  try {
    const cache: ScanCache = {
      repositoryId,
      lastScanTime: Date.now(),
      scanData,
      version: CACHE_VERSION
    };
    
    localStorage.setItem(`${SCAN_CACHE_KEY}_${repositoryId}`, safeStringify(cache));
    console.log(`Scan data cached for repository ${repositoryId}`);
    return true;
  } catch (error) {
    console.error('Error saving scan cache:', error);
    return false;
  }
}

/**
 * Check if a repository needs to be scanned
 */
export function shouldScanRepository(repositoryId?: string): boolean {
  const repoId = repositoryId || getActiveRepository()?.id;
  if (!repoId) return true; // No repository, should scan when one is available
  
  const cache = getCachedScanData(repoId);
  return cache === null; // Should scan if no valid cache exists
}

/**
 * Get time until next scheduled scan
 */
export function getTimeUntilNextScan(repositoryId?: string): number | null {
  const repoId = repositoryId || getActiveRepository()?.id;
  if (!repoId) return null;
  
  const cache = getCachedScanData(repoId);
  if (!cache) return 0; // Should scan now
  
  const nextScanTime = cache.lastScanTime + SCAN_CACHE_DURATION;
  const timeUntilScan = nextScanTime - Date.now();
  
  return Math.max(0, timeUntilScan);
}

/**
 * Clear scan cache for a repository
 */
export function clearScanCache(repositoryId?: string): void {
  const repoId = repositoryId || getActiveRepository()?.id;
  if (!repoId) return;
  
  localStorage.removeItem(`${SCAN_CACHE_KEY}_${repoId}`);
  console.log(`Scan cache cleared for repository ${repoId}`);
}

/**
 * Get human-readable time until next scan
 */
export function getFormattedTimeUntilNextScan(repositoryId?: string): string {
  const timeUntil = getTimeUntilNextScan(repositoryId);
  if (timeUntil === null) return 'No repository selected';
  if (timeUntil === 0) return 'Scan needed';
  
  const days = Math.floor(timeUntil / (24 * 60 * 60 * 1000));
  const hours = Math.floor((timeUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
}

/**
 * Get last scan date for a repository
 */
export function getLastScanDate(repositoryId?: string): Date | null {
  const repoId = repositoryId || getActiveRepository()?.id;
  if (!repoId) return null;
  
  const cache = getCachedScanData(repoId);
  return cache ? new Date(cache.lastScanTime) : null;
}
