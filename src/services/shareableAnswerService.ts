
/**
 * Service for handling shareable answer creation and retrieval
 */

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
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
  
  // For now, we'll simulate storing in localStorage since we don't have a backend
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
  
  // Store in localStorage (in a real app this would go to a database)
  const existingAnswers = JSON.parse(localStorage.getItem('shareableAnswers') || '{}');
  existingAnswers[shareId] = shareableAnswer;
  localStorage.setItem('shareableAnswers', JSON.stringify(existingAnswers));
  
  // Return the shareable link data
  const baseUrl = window.location.origin;
  return {
    id: shareId,
    url: `/share/${shareId}`,
    fullUrl: `${baseUrl}/share/${shareId}`
  };
}

/**
 * Get a shareable answer by ID
 */
export function getShareableAnswer(id: string): ShareableAnswer | null {
  const existingAnswers = JSON.parse(localStorage.getItem('shareableAnswers') || '{}');
  const answer = existingAnswers[id];
  
  if (!answer) return null;
  
  // Increment view count
  answer.views += 1;
  
  // Add referrer if available
  if (document.referrer) {
    answer.referrers.push({
      url: document.referrer,
      date: new Date().toISOString()
    });
  }
  
  // Save updated view count
  existingAnswers[id] = answer;
  localStorage.setItem('shareableAnswers', JSON.stringify(existingAnswers));
  
  return answer;
}

/**
 * Track a share event
 */
export function trackShare(id: string, platform: string): void {
  const existingAnswers = JSON.parse(localStorage.getItem('shareableAnswers') || '{}');
  const answer = existingAnswers[id];
  
  if (!answer) return;
  
  // Increment share count
  answer.shares += 1;
  
  // Save updated share count
  existingAnswers[id] = answer;
  localStorage.setItem('shareableAnswers', JSON.stringify(existingAnswers));
}
