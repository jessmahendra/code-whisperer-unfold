
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

// Helper function to safely get data from storage with detailed logging
function getSafeStorage(): Record<string, ShareableAnswer> {
  console.log("🔍 === STORAGE RETRIEVAL START ===");
  console.log("🔑 Using storage key:", STORAGE_KEY);
  
  try {
    // Check both storages and log everything
    const localData = localStorage.getItem(STORAGE_KEY);
    const sessionData = sessionStorage.getItem(STORAGE_KEY);
    
    console.log("📦 localStorage data:", localData ? `Found ${localData.length} chars` : "NOT FOUND");
    console.log("🗂️ sessionStorage data:", sessionData ? `Found ${sessionData.length} chars` : "NOT FOUND");
    
    // Try localStorage first
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        const keys = Object.keys(parsed);
        console.log("✅ localStorage parsed successfully");
        console.log("📋 localStorage keys found:", keys);
        console.log("📦 Full localStorage data structure:", parsed);
        console.log("🔍 === STORAGE RETRIEVAL END (localStorage success) ===");
        return parsed;
      } catch (parseError) {
        console.error("💥 localStorage parse error:", parseError);
      }
    }
    
    // Fallback to sessionStorage
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        const keys = Object.keys(parsed);
        console.log("✅ sessionStorage parsed successfully");
        console.log("📋 sessionStorage keys found:", keys);
        console.log("🗂️ Full sessionStorage data structure:", parsed);
        console.log("🔍 === STORAGE RETRIEVAL END (sessionStorage success) ===");
        return parsed;
      } catch (parseError) {
        console.error("💥 sessionStorage parse error:", parseError);
      }
    }
    
    console.log("❌ No valid data found in either storage");
    console.log("🔍 === STORAGE RETRIEVAL END (no data) ===");
    return {};
  } catch (error) {
    console.error("💥 Error in getSafeStorage:", error);
    console.log("🔍 === STORAGE RETRIEVAL END (error) ===");
    return {};
  }
}

// Helper function to safely set data to storage with immediate verification
function setSafeStorage(data: Record<string, ShareableAnswer>): boolean {
  console.log("💾 === STORAGE SAVE START ===");
  const keys = Object.keys(data);
  console.log("💾 Attempting to save data with keys:", keys);
  console.log("💾 Full data structure:", data);
  
  let success = false;
  const dataString = JSON.stringify(data);
  console.log("💾 Serialized data length:", dataString.length);
  
  // Try localStorage
  try {
    localStorage.setItem(STORAGE_KEY, dataString);
    console.log("✅ Data written to localStorage");
    
    // Immediate verification
    const verification = localStorage.getItem(STORAGE_KEY);
    if (verification) {
      const verifiedData = JSON.parse(verification);
      const verifiedKeys = Object.keys(verifiedData);
      console.log("✅ localStorage verification successful");
      console.log("📋 Verified keys:", verifiedKeys);
      
      // Check if all keys are present
      const allKeysPresent = keys.every(key => verifiedKeys.includes(key));
      if (allKeysPresent) {
        console.log("✅ All keys verified in localStorage");
        success = true;
      } else {
        console.error("❌ Some keys missing after localStorage save");
        console.error("Expected:", keys);
        console.error("Found:", verifiedKeys);
      }
    } else {
      console.error("❌ localStorage verification failed - no data returned");
    }
  } catch (e) {
    console.error("💥 localStorage save failed:", e);
  }
  
  // Try sessionStorage as backup
  try {
    sessionStorage.setItem(STORAGE_KEY, dataString);
    console.log("✅ Data written to sessionStorage");
    
    // Immediate verification
    const verification = sessionStorage.getItem(STORAGE_KEY);
    if (verification) {
      const verifiedData = JSON.parse(verification);
      const verifiedKeys = Object.keys(verifiedData);
      console.log("✅ sessionStorage verification successful");
      console.log("📋 Verified keys:", verifiedKeys);
      
      // Check if all keys are present
      const allKeysPresent = keys.every(key => verifiedKeys.includes(key));
      if (allKeysPresent) {
        console.log("✅ All keys verified in sessionStorage");
        success = true;
      } else {
        console.error("❌ Some keys missing after sessionStorage save");
      }
    } else {
      console.error("❌ sessionStorage verification failed - no data returned");
    }
  } catch (e) {
    console.error("💥 sessionStorage save failed:", e);
  }
  
  console.log(`💾 === STORAGE SAVE END (success: ${success}) ===`);
  return success;
}

/**
 * Generate a readable but unique ID for shareable answers
 */
export function generateReadableId(): string {
  // Use a combination of words for readable IDs
  const adjectives = ['quick', 'smart', 'clever', 'bright', 'easy', 'simple', 'handy'];
  const nouns = ['answer', 'guide', 'help', 'tip', 'info', 'notes', 'hint'];
  
  // Add randomness with a 5-character alphanumeric string
  const random = Math.random().toString(36).substring(2, 7);
  
  // Pick random words
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  // Combine into readable ID (e.g., "quick-answer-x7f3q")
  return `${adjective}-${noun}-${random}`;
}

/**
 * Create a shareable answer from the current question and answer
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
  
  // Generate a unique, readable ID
  const shareId = generateReadableId();
  console.log(`🆔 Generated share ID: ${shareId}`);
  
  // Create the shareable answer object
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
  
  // Get existing data and add new answer
  console.log("📦 Getting existing storage data...");
  const existingAnswers = getSafeStorage();
  console.log("📦 Existing data retrieved:", existingAnswers);
  
  // Add the new answer
  existingAnswers[shareId] = shareableAnswer;
  console.log("📦 Combined data to save:", existingAnswers);
  
  // Save to storage with verification
  console.log("💾 Saving to storage...");
  const saveSuccess = setSafeStorage(existingAnswers);
  
  if (!saveSuccess) {
    console.error("💥 Failed to save shareable answer to storage");
    throw new Error("Could not save shareable answer to browser storage");
  }
  
  // Double-check by retrieving immediately
  console.log("🔍 Double-checking storage after save...");
  await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for storage to settle
  
  const doubleCheck = getSafeStorage();
  if (!doubleCheck[shareId]) {
    console.error("💥 Double-check failed: Answer not found after save");
    console.error("Expected ID:", shareId);
    console.error("Available IDs:", Object.keys(doubleCheck));
    throw new Error("Storage verification failed after save");
  }
  
  console.log(`✅ Successfully created and verified shareable answer: ${shareId}`);
  
  // Initialize example data if this is the first share
  initializeExampleData();
  
  // Return the shareable link data
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
 * Get a shareable answer by ID with comprehensive debugging
 */
export function getShareableAnswer(id: string): ShareableAnswer | null {
  console.log(`🔍 === GET SHAREABLE ANSWER START ===`);
  console.log(`🎯 Looking for answer with ID: "${id}"`);
  
  if (!id) {
    console.error("❌ No ID provided to getShareableAnswer");
    console.log(`🔍 === GET SHAREABLE ANSWER END (no ID) ===`);
    return null;
  }
  
  try {
    // Get all data from storage
    const existingAnswers = getSafeStorage();
    const availableIds = Object.keys(existingAnswers);
    
    console.log("📋 Available IDs in storage:", availableIds);
    console.log("🔍 Looking for exact match...");
    
    // Check for exact match
    if (existingAnswers[id]) {
      console.log(`✅ Found exact match for ID: ${id}`);
      const answer = existingAnswers[id];
      
      // Update view count and referrer
      answer.views += 1;
      if (document.referrer) {
        answer.referrers.push({
          url: document.referrer,
          date: new Date().toISOString()
        });
      }
      
      // Save updated stats
      existingAnswers[id] = answer;
      setSafeStorage(existingAnswers);
      
      console.log(`✅ Updated view count for ID: ${id}`);
      console.log(`🔍 === GET SHAREABLE ANSWER END (found) ===`);
      return answer;
    }
    
    // If no exact match, try case-insensitive
    console.log("🔍 No exact match, trying case-insensitive search...");
    const caseInsensitiveMatch = availableIds.find(availableId => 
      availableId.toLowerCase() === id.toLowerCase()
    );
    
    if (caseInsensitiveMatch) {
      console.log(`✅ Found case-insensitive match: ${caseInsensitiveMatch}`);
      const answer = existingAnswers[caseInsensitiveMatch];
      console.log(`🔍 === GET SHAREABLE ANSWER END (case match) ===`);
      return answer;
    }
    
    // Log detailed information for debugging
    console.log(`❌ No match found for ID: ${id}`);
    console.log("🔍 Detailed comparison:");
    availableIds.forEach(availableId => {
      console.log(`  - Available: "${availableId}" (length: ${availableId.length})`);
      console.log(`  - Searching: "${id}" (length: ${id.length})`);
      console.log(`  - Match: ${availableId === id}`);
    });
    
    console.log(`🔍 === GET SHAREABLE ANSWER END (not found) ===`);
    return null;
  } catch (error) {
    console.error('💥 Error retrieving shareable answer:', error);
    console.log(`🔍 === GET SHAREABLE ANSWER END (error) ===`);
    return null;
  }
}

/**
 * Track a share event
 */
export function trackShare(id: string, platform: string): void {
  try {
    const existingAnswers = getSafeStorage();
    const answer = existingAnswers[id];
    
    if (!answer) {
      console.warn(`Cannot track share for non-existent ID: ${id}`);
      return;
    }
    
    answer.shares += 1;
    existingAnswers[id] = answer;
    setSafeStorage(existingAnswers);
    
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
    const existingAnswers = getSafeStorage();
    
    // Only add example if storage is empty or doesn't have the example
    if (!existingAnswers['example-demo-abc123']) {
      const exampleAnswer: ShareableAnswer = {
        id: 'example-demo-abc123',
        question: 'How does the share functionality work in the Unfold application?',
        answer: {
          text: "The share functionality in Unfold allows users to create shareable links for answers generated by the system. The links are stored in both localStorage and sessionStorage for better persistence, which means they'll work across different browser sessions unless storage is explicitly cleared. The share feature includes metadata for social sharing and tracks usage analytics like views and share counts.",
          confidence: 0.85,
          references: [
            {
              filePath: 'src/services/shareableAnswerService.ts',
              lineNumbers: '10-250',
              snippet: 'export function createShareableAnswer(...) { ... }',
              lastUpdated: new Date().toISOString()
            },
            {
              filePath: 'src/components/ShareButton.tsx',
              lineNumbers: '20-90',
              snippet: 'export default function ShareButton(...) { ... }',
              lastUpdated: new Date().toISOString()
            }
          ],
          lastUpdated: new Date().toISOString(),
          visualContext: {
            type: 'flowchart',
            syntax: 'graph TD\n  A[User clicks Share] --> B[Generate unique ID]\n  B --> C[Store in localStorage]\n  C --> D[Create shareable URL]\n  D --> E[Copy to clipboard]\n  E --> F[Show success toast]'
          }
        },
        createdAt: new Date().toISOString(),
        views: 12,
        shares: 5,
        referrers: [
          {
            url: 'direct',
            date: new Date().toISOString()
          }
        ]
      };
      
      existingAnswers['example-demo-abc123'] = exampleAnswer;
      setSafeStorage(existingAnswers);
      console.log("Initialized example shareable answer");
    }
  } catch (error) {
    console.error("Error initializing example data:", error);
  }
}

// Initialize example data on module load
initializeExampleData();

/**
 * Listen for shareable answer events from other tabs/windows
 */
if (typeof window !== 'undefined') {
  // Listen for changes in localStorage from other tabs
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
  
  // Listen for custom events from this tab
  window.addEventListener('shareableAnswerCreated', ((event: CustomEvent) => {
    console.log('Shareable answer created event:', event.detail.id);
  }) as EventListener);
}
