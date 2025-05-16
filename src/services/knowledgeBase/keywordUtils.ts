
/**
 * Extracts keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {string[]} Array of keywords
 */
export function extractKeywords(text: string): string[] {
  // Simple keyword extraction (in a real app, this would be more sophisticated)
  const cleaned = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Split into words and filter common words
  const commonWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of']);
  const words = cleaned.split(' ').filter(word => word.length > 2 && !commonWords.has(word));
  
  return Array.from(new Set(words)); // Remove duplicates
}
