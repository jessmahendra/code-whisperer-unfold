
// Interface for knowledge entries
export interface KnowledgeEntry {
  type: 'comment' | 'function' | 'export';
  content: string;
  filePath: string;
  metadata?: Record<string, any>;
  keywords: string[];
}

// Knowledge base statistics interface
export interface KnowledgeBaseStats {
  totalEntries: number;
  byType: {
    comment: number;
    function: number;
    export: number;
  };
  processedFiles: number;
}
