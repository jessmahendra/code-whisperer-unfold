
export interface KnowledgeEntry {
  id: string;
  content: string;
  type: 'comment' | 'function' | 'export' | 'class' | 'api-route' | 'text-content' | 'structured-data' | 'documentation';
  filePath: string;
  keywords: string[];
  lastUpdated: string;
  metadata?: {
    name?: string;
    params?: string;
    value?: string;
    extends?: string | null;
    methods?: string[];
    method?: string;
    path?: string;
    handler?: string;
    category?: string;
    type?: string;
    location?: string;
    contentType?: string;
    dataType?: string;
    commentType?: string;
    originalLength?: number;
  };
}

export interface KnowledgeBaseStats {
  totalEntries: number;
  byType: Record<string, number>;
  processedFiles: number;
}
