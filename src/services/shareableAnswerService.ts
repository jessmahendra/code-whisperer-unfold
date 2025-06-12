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
  console.log("🔍 Getting data from storage...");
  console.log("🔑 Using storage key:", STORAGE_KEY);
  
  try {
    // First try localStorage
    const localData = localStorage.getItem(STORAGE_KEY);
    console.log("📦 localStorage raw data:", localData ? `${localData.length} chars` : "not found");
    
    if (localData) {
      const parsed = JSON.parse(localData);
      const keys = Object.keys(parsed);
      console.log("📦 localStorage parsed data keys:", keys);
      console.log("📦 localStorage data structure:", parsed);
      return parsed;
    }
    
    // Fallback to sessionStorage
    const sessionData = sessionStorage.getItem(STORAGE_KEY);
    console.log("🗂️ sessionStorage raw data:", sessionData ? `${sessionData.length} chars` : "not found");
    
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      const keys = Object.keys(parsed);
      console.log("🗂️ sessionStorage parsed data keys:", keys);
      console.log("🗂️ sessionStorage data structure:", parsed);
      return parsed;
    }
    
    console.log("❌ No data found in either storage");
    return {};
  } catch (error) {
    console.error("💥 Error getting storage:", error);
    return {};
  }
}

// Helper function to safely set data to storage with better error handling
function setSafeStorage(data: Record<string, ShareableAnswer>): boolean {
  const keys = Object.keys(data);
  console.log("💾 Saving data to storage with keys:", keys);
  console.log("💾 Full data being saved:", data);
  let success = false;
  
  try {
    // Try localStorage first
    const dataString = JSON.stringify(data);
    console.log("💾 Serialized data length:", dataString.length);
    localStorage.setItem(STORAGE_KEY, dataString);
    console.log("✅ Successfully saved to localStorage");
    
    // Immediately verify localStorage save
    const verification = localStorage.getItem(STORAGE_KEY);
    if (verification) {
      const verifiedData = JSON.parse(verification);
      const verifiedKeys = Object.keys(verifiedData);
      console.log("✅ localStorage verification successful, keys:", verifiedKeys);
      success = true;
    } else {
      console.error("❌ localStorage verification failed");
    }
  } catch (e) {
    console.warn("⚠️ Failed to save to localStorage:", e);
  }
  
  try {
    // Also try sessionStorage as backup
    const dataString = JSON.stringify(data);
    sessionStorage.setItem(STORAGE_KEY, dataString);
    console.log("✅ Successfully saved to sessionStorage");
    
    // Immediately verify sessionStorage save
    const verification = sessionStorage.getItem(STORAGE_KEY);
    if (verification) {
      const verifiedData = JSON.parse(verification);
      const verifiedKeys = Object.keys(verifiedData);
      console.log("✅ sessionStorage verification successful, keys:", verifiedKeys);
      success = true;
    } else {
      console.error("❌ sessionStorage verification failed");
    }
  } catch (e) {
    console.warn("⚠️ Failed to save to sessionStorage:", e);
  }
  
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
  // Generate a unique, readable ID
  const shareId = generateReadableId();
  console.log(`🎯 Creating shareable answer with ID: ${shareId}`);
  
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
  const existingAnswers = getSafeStorage();
  existingAnswers[shareId] = shareableAnswer;
  
  console.log("📦 Combined data before save:", existingAnswers);
  
  // Save to storage
  const saveSuccess = setSafeStorage(existingAnswers);
  
  if (!saveSuccess) {
    console.error("💥 Failed to save shareable answer to any storage");
    throw new Error("Could not save shareable answer");
  }
  
  // Verify storage operation succeeded immediately with multiple checks
  console.log("🔍 Starting verification process...");
  
  // Wait a brief moment for storage to settle
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const verifyStorage = getSafeStorage();
  console.log("🔍 Verification storage keys:", Object.keys(verifyStorage));
  
  if (!verifyStorage[shareId]) {
    console.error("💥 Storage verification failed: Answer not found after save");
    console.error("Expected ID:", shareId);
    console.error("Available IDs:", Object.keys(verifyStorage));
    
    // Try one more time with direct access
    try {
      const directCheck = localStorage.getItem(STORAGE_KEY);
      if (directCheck) {
        const directParsed = JSON.parse(directCheck);
        console.log("🔍 Direct localStorage check:", directParsed);
        if (directParsed[shareId]) {
          console.log("✅ Found via direct check, continuing...");
        } else {
          throw new Error("Storage verification failed after direct check");
        }
      } else {
        throw new Error("No data in localStorage after save");
      }
    } catch (directError) {
      console.error("💥 Direct verification also failed:", directError);
      throw new Error("Storage verification failed");
    }
  } else {
    console.log(`✅ Successfully saved and verified shareable answer: ${shareId}`);
  }
  
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
  return result;
}

/**
 * Get a shareable answer by ID with improved debugging
 */
export function getShareableAnswer(id: string): ShareableAnswer | null {
  if (!id) {
    console.error("❌ No ID provided to getShareableAnswer");
    return null;
  }
  
  console.log(`🔍 === GET SHAREABLE ANSWER START ===`);
  console.log(`🎯 Attempting to get shareable answer with ID: "${id}"`);
  console.log(`🔑 Using storage key: "${STORAGE_KEY}"`);
  
  try {
    // Get data from storage with detailed logging
    const existingAnswers = getSafeStorage();
    const availableIds = Object.keys(existingAnswers);
    console.log("📦 Available IDs in storage:", availableIds);
    console.log("📦 Full storage data:", existingAnswers);
    
    // Check if the ID exists (case-sensitive check)
    const exactMatch = existingAnswers[id];
    if (exactMatch) {
      console.log(`✅ Found exact match for ID "${id}"`);
      console.log("📄 Answer data:", exactMatch);
      
      // Update view count and referrer
      exactMatch.views += 1;
      
      // Add referrer if available
      if (document.referrer) {
        exactMatch.referrers.push({
          url: document.referrer,
          date: new Date().toISOString()
        });
      }
      
      // Save updated stats
      existingAnswers[id] = exactMatch;
      setSafeStorage(existingAnswers);
      
      console.log(`✅ Successfully found and updated answer for ID ${id}`);
      console.log(`🔍 === GET SHAREABLE ANSWER END (SUCCESS) ===`);
      return exactMatch;
    }
    
    // If no exact match found
    console.log(`❌ No exact match found for ID "${id}"`);
    console.log("🔍 Checking for partial matches...");
    
    // Try to find partial matches for debugging
    const partialMatches = availableIds.filter(availableId => 
      availableId.includes(id) || id.includes(availableId)
    );
    
    if (partialMatches.length > 0) {
      console.log("🔍 Partial matches found:", partialMatches);
    } else {
      console.log("🔍 No partial matches found either");
    }
    
    // Try case-insensitive search
    const caseInsensitiveMatch = availableIds.find(availableId => 
      availableId.toLowerCase() === id.toLowerCase()
    );
    
    if (caseInsensitiveMatch) {
      console.log("🔍 Found case-insensitive match:", caseInsensitiveMatch);
      const answer = existingAnswers[caseInsensitiveMatch];
      console.log(`🔍 === GET SHAREABLE ANSWER END (CASE MISMATCH) ===`);
      return answer;
    }
    
    console.log(`🔍 === GET SHAREABLE ANSWER END (NOT FOUND) ===`);
    return null;
  } catch (error) {
    console.error('💥 Error retrieving shareable answer:', error);
    console.log(`🔍 === GET SHAREABLE ANSWER END (ERROR) ===`);
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
