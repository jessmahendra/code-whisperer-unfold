/**
 * Enhanced keyword extraction with UI-specific handling
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
  const commonWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'
  ]);
  
  const words = cleaned.split(' ').filter(word => word.length > 2 && !commonWords.has(word));
  
  // Enhanced keyword processing for UI-related terms
  const enhancedKeywords = words.map(word => {
    // Handle compound terms like "portal-settings" or "admin_x_settings"
    if (word.includes('-') || word.includes('_')) {
      return word.split(/[-_]/).filter(part => part.length > 2);
    }
    return [word];
  }).flat();
  
  // Add semantic variations for UI terms
  const semanticVariations: string[] = [];
  enhancedKeywords.forEach(keyword => {
    // Add variations for common UI terms
    if (keyword === 'subtitle') {
      semanticVariations.push('subheading', 'description', 'label');
    } else if (keyword === 'settings') {
      semanticVariations.push('config', 'configuration', 'admin');
    } else if (keyword === 'membership') {
      semanticVariations.push('member', 'subscription', 'portal');
    } else if (keyword === 'component') {
      semanticVariations.push('ui', 'interface', 'element');
    } else if (keyword === 'page') {
      semanticVariations.push('view', 'screen', 'interface');
    }
  });
  
  const allKeywords = [...enhancedKeywords, ...semanticVariations];
  
  return Array.from(new Set(allKeywords)); // Remove duplicates
}
