/**
 * Service for handling shareable answer creation and retrieval
 */

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
  author?: string;
  authorEmail?: string;
}

interface VisualContext {
  type: 'flowchart' | 'component' | 'state';
  syntax: string;
}

export interface ShareableAnswer {
  id: string;
  question: string;
  answer: {
    text: string;
    confidence: number;
    references: Reference[];
    lastUpdated?: string;
    visualContext?: VisualContext;
  };
  createdAt: string;
  views: number;
  shares: number;
  referrers: {
    url: string;
    date: string;
  }[];
}

// Storage key for local and session storage
const STORAGE_KEY = 'unfold_shareableAnswers';

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

// Enhanced storage operations with redundancy and verification
async function saveDataWithVerification(data: Record<string, ShareableAnswer>): Promise<boolean> {
  console.log("💾 === ENHANCED STORAGE SAVE START ===");
  const dataString = safeStringify(data);
  const keys = Object.keys(data);
  console.log("💾 Saving", keys.length, "items:", keys);
  
  let success = false;
  
  try {
    // Save to both storages simultaneously for redundancy
    localStorage.setItem(STORAGE_KEY, dataString);
    sessionStorage.setItem(STORAGE_KEY, dataString);
    
    // Wait a moment for storage to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify both storages
    const localCheck = localStorage.getItem(STORAGE_KEY);
    const sessionCheck = sessionStorage.getItem(STORAGE_KEY);
    
    if (localCheck && sessionCheck) {
      const localData = JSON.parse(localCheck);
      const sessionData = JSON.parse(sessionCheck);
      const localKeys = Object.keys(localData);
      const sessionKeys = Object.keys(sessionData);
      
      // Verify all keys are present in both storages
      const allKeysInLocal = keys.every(key => localKeys.includes(key));
      const allKeysInSession = keys.every(key => sessionKeys.includes(key));
      
      if (allKeysInLocal && allKeysInSession) {
        console.log("✅ Data successfully saved and verified in both storages");
        success = true;
      } else {
        console.error("❌ Key verification failed");
        console.error("Expected keys:", keys);
        console.error("Local keys:", localKeys);
        console.error("Session keys:", sessionKeys);
      }
    } else {
      console.error("❌ Storage verification failed - data not found after save");
    }
  } catch (error) {
    console.error("💥 Storage save failed:", error);
  }
  
  console.log(`💾 === ENHANCED STORAGE SAVE END (success: ${success}) ===`);
  return success;
}

function loadDataWithFallback(): Record<string, ShareableAnswer> {
  console.log("📦 === ENHANCED STORAGE LOAD START ===");
  
  try {
    // Try localStorage first
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        const keys = Object.keys(parsed);
        console.log("✅ Successfully loaded from localStorage:", keys.length, "items");
        console.log("📋 Keys:", keys);
        return parsed;
      } catch (parseError) {
        console.error("💥 localStorage parse error:", parseError);
      }
    }
    
    // Fallback to sessionStorage
    const sessionData = sessionStorage.getItem(STORAGE_KEY);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        const keys = Object.keys(parsed);
        console.log("✅ Successfully loaded from sessionStorage:", keys.length, "items");
        console.log("📋 Keys:", keys);
        return parsed;
      } catch (parseError) {
        console.error("💥 sessionStorage parse error:", parseError);
      }
    }
    
    console.log("❌ No valid data found in either storage");
    return {};
  } catch (error) {
    console.error("💥 Error in loadDataWithFallback:", error);
    return {};
  } finally {
    console.log("📦 === ENHANCED STORAGE LOAD END ===");
  }
}

/**
 * Generate a readable but unique ID for shareable answers
 */
export function generateReadableId(): string {
  const adjectives = ['quick', 'smart', 'clever', 'bright', 'easy', 'simple', 'handy'];
  const nouns = ['answer', 'guide', 'help', 'tip', 'info', 'notes', 'hint'];
  const random = Math.random().toString(36).substring(2, 7);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}-${noun}-${random}`;
}

/**
 * Create a shareable answer with enhanced persistence and verification
 */
export async function createShareableAnswer(
  question: string, 
  answer: {
    text: string;
    confidence: number;
    references: Reference[];
    visualContext?: VisualContext;
  }
): Promise<{ id: string; url: string; fullUrl: string }> {
  console.log("🎯 === CREATE SHAREABLE ANSWER START ===");
  
  const shareId = generateReadableId();
  console.log(`🆔 Generated share ID: ${shareId}`);
  
  const shareableAnswer: ShareableAnswer = {
    id: shareId,
    question,
    answer: {
      text: answer.text,
      confidence: answer.confidence,
      references: answer.references || [],
      lastUpdated: new Date().toISOString(),
      visualContext: answer.visualContext
    },
    createdAt: new Date().toISOString(),
    views: 0,
    shares: 0,
    referrers: []
  };
  
  console.log("📝 Created shareable answer object:", shareableAnswer);
  
  // Load existing data
  const existingAnswers = loadDataWithFallback();
  existingAnswers[shareId] = shareableAnswer;
  
  // Save with enhanced verification
  const saveSuccess = await saveDataWithVerification(existingAnswers);
  
  if (!saveSuccess) {
    console.error("💥 Failed to save shareable answer");
    throw new Error("Could not save shareable answer to browser storage");
  }
  
  // Triple-check by loading again
  await new Promise(resolve => setTimeout(resolve, 200));
  const verificationData = loadDataWithFallback();
  
  if (!verificationData[shareId]) {
    console.error("💥 Final verification failed");
    throw new Error("Storage verification failed - answer not found after save");
  }
  
  console.log(`✅ Successfully created and verified shareable answer: ${shareId}`);
  
  // Initialize example data if needed
  initializeExampleData();
  
  const baseUrl = window.location.origin;
  const result = {
    id: shareId,
    url: `/share/${shareId}`,
    fullUrl: `${baseUrl}/share/${shareId}`
  };
  
  console.log("🔗 Returning shareable link data:", result);
  console.log("🎯 === CREATE SHAREABLE ANSWER END ===");
  return result;
}

/**
 * Get a shareable answer by ID with enhanced debugging and fallback mechanisms
 */
export function getShareableAnswer(id: string): ShareableAnswer | null {
  console.log(`🔍 === GET SHAREABLE ANSWER START ===`);
  console.log(`🎯 Looking for answer with ID: "${id}"`);
  
  if (!id || typeof id !== 'string' || id.trim() === '') {
    console.error("❌ Invalid ID provided:", id);
    return null;
  }
  
  const cleanId = id.trim();
  console.log(`🧹 Cleaned ID: "${cleanId}"`);
  
  try {
    const existingAnswers = loadDataWithFallback();
    const availableIds = Object.keys(existingAnswers);
    
    console.log("📋 Available IDs in storage:", availableIds);
    
    // Check for exact match
    if (existingAnswers[cleanId]) {
      console.log(`✅ Found exact match for ID: ${cleanId}`);
      const answer = existingAnswers[cleanId];
      
      // Update view count
      answer.views += 1;
      if (document.referrer) {
        answer.referrers.push({
          url: document.referrer,
          date: new Date().toISOString()
        });
      }
      
      // Save updated stats (fire and forget)
      existingAnswers[cleanId] = answer;
      saveDataWithVerification(existingAnswers).catch(console.error);
      
      console.log(`🔍 === GET SHAREABLE ANSWER END (found) ===`);
      return answer;
    }
    
    // Try case-insensitive match
    const caseInsensitiveMatch = availableIds.find(availableId => 
      availableId.toLowerCase() === cleanId.toLowerCase()
    );
    
    if (caseInsensitiveMatch) {
      console.log(`✅ Found case-insensitive match: ${caseInsensitiveMatch}`);
      const answer = existingAnswers[caseInsensitiveMatch];
      console.log(`🔍 === GET SHAREABLE ANSWER END (case match) ===`);
      return answer;
    }
    
    console.log(`❌ No match found for ID: ${cleanId}`);
    console.log("🔍 Available IDs:", availableIds);
    return null;
  } catch (error) {
    console.error('💥 Error retrieving shareable answer:', error);
    return null;
  } finally {
    console.log(`🔍 === GET SHAREABLE ANSWER END ===`);
  }
}

/**
 * Track a share event
 */
export function trackShare(id: string, platform: string): void {
  try {
    const existingAnswers = loadDataWithFallback();
    const answer = existingAnswers[id];
    
    if (!answer) {
      console.warn(`Cannot track share for non-existent ID: ${id}`);
      return;
    }
    
    answer.shares += 1;
    existingAnswers[id] = answer;
    saveDataWithVerification(existingAnswers).catch(console.error);
    
    console.log(`Tracked share for ID ${id} on ${platform}`);
  } catch (error) {
    console.error('Error tracking share:', error);
  }
}

/**
 * Initialize example data only if storage is empty
 */
function initializeExampleData(): void {
  try {
    const existingAnswers = loadDataWithFallback();
    
    if (!existingAnswers['example-demo-abc123']) {
      const exampleAnswer: ShareableAnswer = {
        id: 'example-demo-abc123',
        question: 'How does the share functionality work in the Unfold application?',
        answer: {
          text: "The share functionality in Unfold allows users to create shareable links for answers generated by the system. The links are stored in both localStorage and sessionStorage for better persistence, which means they'll work across different browser sessions unless storage is explicitly cleared.",
          confidence: 0.85,
          references: [
            {
              filePath: 'src/services/shareableAnswerService.ts',
              lineNumbers: '10-250',
              snippet: 'export function createShareableAnswer(...) { ... }',
              lastUpdated: new Date().toISOString()
            }
          ],
          lastUpdated: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        views: 12,
        shares: 5,
        referrers: [{
          url: 'direct',
          date: new Date().toISOString()
        }]
      };
      
      existingAnswers['example-demo-abc123'] = exampleAnswer;
      saveDataWithVerification(existingAnswers).catch(console.error);
      console.log("Initialized example shareable answer");
    }
  } catch (error) {
    console.error("Error initializing example data:", error);
  }
}

// Initialize example data on module load
initializeExampleData();

// Enhanced cross-tab synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      console.log("Storage event detected, synchronizing data");
      try {
        sessionStorage.setItem(STORAGE_KEY, event.newValue);
      } catch (error) {
        console.warn("Failed to synchronize sessionStorage:", error);
      }
    }
  });
}
