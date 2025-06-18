
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
    
    // Log entries by file type for debugging
    const entriesByType = relevantEntries.reduce((acc, entry) => {
      const fileType = entry.metadata?.fileType || 'unknown';
      if (!acc[fileType]) acc[fileType] = [];
      acc[fileType].push(entry);
      return acc;
    }, {} as Record<string, KnowledgeEntry[]>);
    
    console.log('Relevant entries by file type:');
    Object.entries(entriesByType).forEach(([type, entries]) => {
      console.log(`  ${type}: ${entries.length} entries`);
      entries.slice(0, 2).forEach((entry, i) => {
        console.log(`    ${i + 1}. ${entry.filePath}: ${entry.content.substring(0, 100)}...`);
      });
    });
    
    // Generate a structured answer based on the relevant entries
    const answer = generateStructuredAnswer(question, relevantEntries, options);
    
    if (answer) {
      console.log(`Answer generated successfully with confidence: ${answer.confidence}`);
      console.log(`Answer includes ${answer.references.length} references from ${new Set(answer.references.map(r => r.metadata?.fileType || 'unknown')).size} file types`);
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
 * Classifies the question type for better answer generation
 */
function classifyQuestionForAnswering(question: string): {
  type: 'readme' | 'howto' | 'architecture' | 'technical' | 'configuration' | 'general';
  needsMultiSource: boolean;
  preferredSources: string[];
} {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('readme') || lowerQuestion.includes('summary') || lowerQuestion.includes('overview')) {
    return {
      type: 'readme',
      needsMultiSource: false,
      preferredSources: ['documentation', 'markdown']
    };
  }
  
  if (lowerQuestion.includes('how to') || lowerQuestion.includes('how do') || lowerQuestion.includes('implement')) {
    return {
      type: 'howto',
      needsMultiSource: true,
      preferredSources: ['typescript', 'javascript', 'documentation']
    };
  }
  
  if (lowerQuestion.includes('architecture') || lowerQuestion.includes('structure') || lowerQuestion.includes('organization')) {
    return {
      type: 'architecture',
      needsMultiSource: true,
      preferredSources: ['typescript', 'javascript', 'json', 'documentation']
    };
  }
  
  if (lowerQuestion.includes('config') || lowerQuestion.includes('setup') || lowerQuestion.includes('install')) {
    return {
      type: 'configuration',
      needsMultiSource: true,
      preferredSources: ['json', 'yaml', 'documentation']
    };
  }
  
  if (lowerQuestion.includes('function') || lowerQuestion.includes('component') || lowerQuestion.includes('api')) {
    return {
      type: 'technical',
      needsMultiSource: true,
      preferredSources: ['typescript', 'javascript', 'documentation']
    };
  }
  
  return {
    type: 'general',
    needsMultiSource: true,
    preferredSources: ['documentation', 'typescript', 'javascript']
  };
}

/**
 * Groups entries by source type for multi-source answers
 */
function groupEntriesBySource(entries: KnowledgeEntry[]): {
  documentation: KnowledgeEntry[];
  code: KnowledgeEntry[];
  config: KnowledgeEntry[];
  other: KnowledgeEntry[];
} {
  return entries.reduce((acc, entry) => {
    const fileType = entry.metadata?.fileType || 'unknown';
    
    if (fileType === 'documentation' || fileType === 'markdown' || entry.metadata?.isReadme) {
      acc.documentation.push(entry);
    } else if (['typescript', 'javascript'].includes(fileType) || entry.type === 'function') {
      acc.code.push(entry);
    } else if (['json', 'yaml'].includes(fileType)) {
      acc.config.push(entry);
    } else {
      acc.other.push(entry);
    }
    
    return acc;
  }, {
    documentation: [] as KnowledgeEntry[],
    code: [] as KnowledgeEntry[],
    config: [] as KnowledgeEntry[],
    other: [] as KnowledgeEntry[]
  });
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
  
  const questionClassification = classifyQuestionForAnswering(question);
  console.log(`Question classification:`, questionClassification);
  
  // Group entries by source type
  const groupedEntries = groupEntriesBySource(entries);
  
  // Generate answer based on question type and available sources
  let answerText = '';
  let confidence = 0.5;
  
  if (questionClassification.type === 'readme' && groupedEntries.documentation.length > 0) {
    answerText = generateReadmeAnswer(groupedEntries.documentation[0]);
    confidence = 0.9;
  } else if (questionClassification.needsMultiSource) {
    answerText = generateMultiSourceAnswer(question, groupedEntries, questionClassification, options);
    confidence = calculateMultiSourceConfidence(groupedEntries, question);
  } else {
    answerText = generateSingleSourceAnswer(question, entries.slice(0, 5), options);
    confidence = calculateConfidence(entries.slice(0, 5), question);
  }
  
  if (!answerText) {
    return null;
  }
  
  // Create comprehensive references from all relevant entries
  const references = entries.slice(0, 8).map(entry => ({
    path: entry.filePath,
    type: entry.type,
    snippet: entry.content.substring(0, 200) + (entry.content.length > 200 ? '...' : ''),
    metadata: entry.metadata
  }));
  
  return {
    text: answerText,
    confidence: Math.min(confidence, 1.0),
    references: references,
    questionType: questionClassification.type,
    sourcesUsed: {
      documentation: groupedEntries.documentation.length,
      code: groupedEntries.code.length,
      config: groupedEntries.config.length,
      other: groupedEntries.other.length
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Generates a multi-source answer combining information from different file types
 */
function generateMultiSourceAnswer(
  question: string,
  groupedEntries: ReturnType<typeof groupEntriesBySource>,
  classification: ReturnType<typeof classifyQuestionForAnswering>,
  options: AnswerGenerationOptions
): string {
  const sections: string[] = [];
  
  // Add overview from documentation if available
  if (groupedEntries.documentation.length > 0 && classification.type !== 'technical') {
    const docContent = groupedEntries.documentation[0].content.substring(0, 300);
    if (docContent.trim()) {
      sections.push(`## Overview\n\n${docContent}`);
    }
  }
  
  // Add technical implementation details from code
  if (groupedEntries.code.length > 0) {
    const codeEntries = groupedEntries.code.slice(0, 3);
    const codeInfo = codeEntries.map(entry => {
      if (entry.type === 'function') {
        return `**${entry.filePath}**: ${entry.content}`;
      } else {
        return `**${entry.filePath}**: ${entry.content.substring(0, 200)}`;
      }
    }).join('\n\n');
    
    if (codeInfo.trim()) {
      sections.push(`## Implementation\n\n${codeInfo}`);
    }
  }
  
  // Add configuration details if relevant
  if (groupedEntries.config.length > 0 && classification.type === 'configuration') {
    const configContent = groupedEntries.config[0].content.substring(0, 300);
    if (configContent.trim()) {
      sections.push(`## Configuration\n\n${configContent}`);
    }
  }
  
  // Add other relevant information
  if (groupedEntries.other.length > 0 && sections.length < 2) {
    const otherContent = groupedEntries.other[0].content.substring(0, 200);
    if (otherContent.trim()) {
      sections.push(`## Additional Information\n\n${otherContent}`);
    }
  }
  
  return sections.join('\n\n');
}

/**
 * Generates a single-source answer (fallback)
 */
function generateSingleSourceAnswer(
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
        return `**Function**: ${entry.content}`;
      } else {
        return entry.content.substring(0, 200);
      }
    })
    .join('\n\n');
  
  if (!topContent) {
    return '';
  }
  
  const intro = options.skipBenefits ? '' : 'Based on the available information:\n\n';
  
  return `${intro}${topContent}`;
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
  
  return `## Project Overview\n\n${summary}${summary.length >= 500 ? '...' : ''}`;
}

/**
 * Calculates confidence score for multi-source answers
 */
function calculateMultiSourceConfidence(
  groupedEntries: ReturnType<typeof groupEntriesBySource>,
  question: string
): number {
  const totalEntries = Object.values(groupedEntries).reduce((sum, entries) => sum + entries.length, 0);
  if (totalEntries === 0) return 0;
  
  let baseConfidence = Math.min(totalEntries / 8, 0.8);
  
  // Boost for diversity of sources
  const sourceTypes = Object.values(groupedEntries).filter(entries => entries.length > 0).length;
  baseConfidence += (sourceTypes - 1) * 0.05; // Up to +0.15 for diverse sources
  
  // Boost for high-priority content
  const hasHighPriority = Object.values(groupedEntries)
    .flat()
    .some(entry => entry.metadata?.priority === 'high');
  if (hasHighPriority) {
    baseConfidence += 0.1;
  }
  
  return Math.min(baseConfidence, 0.95);
}

/**
 * Calculates confidence score based on entries and question match (fallback)
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
