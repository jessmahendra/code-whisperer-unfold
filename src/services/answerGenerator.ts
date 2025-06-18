import { searchKnowledge } from './knowledgeBase';
import { KnowledgeEntry } from './knowledgeBase/types';

export interface AnswerGenerationOptions {
  concise?: boolean;
  skipBenefits?: boolean;
}

/**
 * Generates an answer to a user's question based on the knowledge base
 * @param {string} question - The user's question
 * @param {AnswerGenerationOptions} options - Options for answer generation
 * @returns {Promise<any>} Generated answer object or null if no answer could be generated
 */
export async function generateAnswer(
  question: string, 
  options: AnswerGenerationOptions = {}
): Promise<any> {
  console.log(`Generating answer for: "${question}"`);
  
  try {
    // Search for relevant knowledge entries (now async)
    const relevantEntries = await searchKnowledge(question);
    
    console.log(`Found ${relevantEntries.length} relevant entries for question`);
    
    if (relevantEntries.length === 0) {
      console.log('No relevant entries found in knowledge base');
      return null;
    }
    
    // Log first few entries for debugging
    console.log('Sample relevant entries:');
    relevantEntries.slice(0, 3).forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.filePath} (${entry.type}): ${entry.content.substring(0, 100)}...`);
    });
    
    // Generate a structured answer based on the relevant entries
    const answer = generateStructuredAnswer(question, relevantEntries, options);
    
    if (answer) {
      console.log(`Answer generated successfully with confidence: ${answer.confidence}`);
    } else {
      console.log('Failed to generate answer from relevant entries');
    }
    
    return answer;
  } catch (error) {
    console.error('Error in generateAnswer:', error);
    return null;
  }
}

/**
 * Generates a structured answer based on relevant knowledge entries
 * @param {string} question - The user's question
 * @param {KnowledgeEntry[]} entries - Relevant knowledge entries
 * @param {AnswerGenerationOptions} options - Options for answer generation
 * @returns {any} Structured answer object or null
 */
function generateStructuredAnswer(
  question: string, 
  entries: KnowledgeEntry[], 
  options: AnswerGenerationOptions = {}
): any {
  if (entries.length === 0) {
    return null;
  }
  
  const lowerQuestion = question.toLowerCase();
  
  // Determine question type for better answer formatting
  const isReadmeQuestion = lowerQuestion.includes('readme') || 
                          lowerQuestion.includes('summary') || 
                          lowerQuestion.includes('summarize') ||
                          lowerQuestion.includes('overview') ||
                          lowerQuestion.includes('what is this') ||
                          lowerQuestion.includes('about this project');
  
  const isHowToQuestion = lowerQuestion.includes('how to') || 
                         lowerQuestion.startsWith('how do') ||
                         lowerQuestion.startsWith('how can');
  
  const isArchitectureQuestion = lowerQuestion.includes('architecture') ||
                                lowerQuestion.includes('structure') ||
                                lowerQuestion.includes('organization');
  
  // Prioritize entries based on question type
  let sortedEntries = [...entries];
  
  if (isReadmeQuestion) {
    // For README questions, prioritize README content
    sortedEntries.sort((a, b) => {
      const aIsReadme = a.metadata?.isReadme || a.filePath.toLowerCase().includes('readme');
      const bIsReadme = b.metadata?.isReadme || b.filePath.toLowerCase().includes('readme');
      
      if (aIsReadme && !bIsReadme) return -1;
      if (!aIsReadme && bIsReadme) return 1;
      return 0;
    });
  }
  
  // Take the most relevant entries (limit based on question type)
  const maxEntries = isReadmeQuestion ? 3 : isHowToQuestion ? 5 : 8;
  const topEntries = sortedEntries.slice(0, maxEntries);
  
  // Generate answer content based on question type
  let answerText = '';
  let confidence = 0.5;
  
  if (isReadmeQuestion && topEntries.some(e => e.metadata?.isReadme || e.filePath.toLowerCase().includes('readme'))) {
    // README-specific answer generation
    const readmeEntry = topEntries.find(e => e.metadata?.isReadme || e.filePath.toLowerCase().includes('readme'));
    if (readmeEntry) {
      answerText = generateReadmeAnswer(readmeEntry);
      confidence = 0.9;
    }
  } else if (isHowToQuestion) {
    // How-to specific answer generation
    answerText = generateHowToAnswer(question, topEntries, options);
    confidence = calculateConfidence(topEntries, question);
  } else if (isArchitectureQuestion) {
    // Architecture-specific answer generation
    answerText = generateArchitectureAnswer(topEntries);
    confidence = calculateConfidence(topEntries, question);
  } else {
    // General answer generation
    answerText = generateGeneralAnswer(question, topEntries, options);
    confidence = calculateConfidence(topEntries, question);
  }
  
  if (!answerText) {
    return null;
  }
  
  // Create references from the entries used
  const references = topEntries.map(entry => ({
    path: entry.filePath,
    type: entry.type,
    snippet: entry.content.substring(0, 200) + (entry.content.length > 200 ? '...' : ''),
    metadata: entry.metadata
  }));
  
  return {
    text: answerText,
    confidence: Math.min(confidence, 1.0),
    references: references,
    questionType: isReadmeQuestion ? 'readme' : isHowToQuestion ? 'howto' : isArchitectureQuestion ? 'architecture' : 'general',
    timestamp: new Date().toISOString()
  };
}

/**
 * Generates a README-specific answer
 * @param {KnowledgeEntry} readmeEntry - The README entry
 * @returns {string} Generated answer text
 */
function generateReadmeAnswer(readmeEntry: KnowledgeEntry): string {
  const content = readmeEntry.content;
  
  // Try to extract key sections from README
  const lines = content.split('\n').filter(line => line.trim());
  let summary = '';
  
  // Look for project description (usually in first few paragraphs)
  const descriptionLines = lines.slice(0, 10).filter(line => 
    !line.startsWith('#') && 
    !line.startsWith('![') && 
    line.length > 20
  );
  
  if (descriptionLines.length > 0) {
    summary = descriptionLines.slice(0, 3).join(' ').substring(0, 500);
  } else {
    summary = content.substring(0, 500);
  }
  
  return `Based on the README file:\n\n${summary}${summary.length >= 500 ? '...' : ''}`;
}

/**
 * Generates a how-to specific answer
 * @param {string} question - The user's question
 * @param {KnowledgeEntry[]} entries - Relevant entries
 * @param {AnswerGenerationOptions} options - Generation options
 * @returns {string} Generated answer text
 */
function generateHowToAnswer(
  question: string, 
  entries: KnowledgeEntry[], 
  options: AnswerGenerationOptions
): string {
  const relevantContent = entries
    .filter(entry => entry.type === 'function' || entry.type === 'content')
    .slice(0, 3)
    .map(entry => entry.content)
    .join('\n\n');
  
  if (!relevantContent) {
    return '';
  }
  
  const conciseIntro = options.concise ? '' : 'Here\'s how you can accomplish this:\n\n';
  
  return `${conciseIntro}${relevantContent.substring(0, 800)}${relevantContent.length > 800 ? '...' : ''}`;
}

/**
 * Generates an architecture-specific answer
 * @param {KnowledgeEntry[]} entries - Relevant entries
 * @returns {string} Generated answer text
 */
function generateArchitectureAnswer(entries: KnowledgeEntry[]): string {
  const structuralEntries = entries.filter(entry => 
    entry.type === 'export' || 
    entry.filePath.includes('src/') || 
    entry.filePath.includes('components/') ||
    entry.filePath.includes('services/')
  );
  
  if (structuralEntries.length === 0) {
    return '';
  }
  
  const architectureInfo = structuralEntries
    .slice(0, 5)
    .map(entry => `**${entry.filePath}**: ${entry.content.substring(0, 200)}`)
    .join('\n\n');
  
  return `Based on the codebase structure:\n\n${architectureInfo}`;
}

/**
 * Generates a general answer
 * @param {string} question - The user's question
 * @param {KnowledgeEntry[]} entries - Relevant entries
 * @param {AnswerGenerationOptions} options - Generation options
 * @returns {string} Generated answer text
 */
function generateGeneralAnswer(
  question: string, 
  entries: KnowledgeEntry[], 
  options: AnswerGenerationOptions
): string {
  const topContent = entries
    .slice(0, 4)
    .map(entry => {
      if (entry.type === 'content') {
        return entry.content.substring(0, 300);
      } else if (entry.type === 'function') {
        return `Function: ${entry.content}`;
      } else {
        return entry.content.substring(0, 200);
      }
    })
    .join('\n\n');
  
  if (!topContent) {
    return '';
  }
  
  const intro = options.skipBenefits ? '' : 'Based on the available information:\n\n';
  
  return `${intro}${topContent}${topContent.length > 1000 ? '...' : ''}`;
}

/**
 * Calculates confidence score based on entries and question match
 * @param {KnowledgeEntry[]} entries - Knowledge entries
 * @param {string} question - User's question
 * @returns {number} Confidence score between 0 and 1
 */
function calculateConfidence(entries: KnowledgeEntry[], question: string): number {
  if (entries.length === 0) return 0;
  
  let baseConfidence = Math.min(entries.length / 5, 0.8);
  
  // Boost confidence for high-priority content
  const hasHighPriority = entries.some(entry => entry.metadata?.priority === 'high');
  if (hasHighPriority) {
    baseConfidence += 0.1;
  }
  
  // Boost confidence for content-type entries
  const contentEntries = entries.filter(entry => entry.type === 'content').length;
  baseConfidence += (contentEntries / entries.length) * 0.1;
  
  return Math.min(baseConfidence, 0.95);
}
