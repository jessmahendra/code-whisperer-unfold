
export interface KnowledgeEntry {
  id: string;
  content: string;
  type: 'comment' | 'function' | 'export' | 'class' | 'api-route' | 'job-listing' | 'job-content' | 'job-data' | 'job-comment' | 'job-function';
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
  };
}

export interface KnowledgeBaseStats {
  totalEntries: number;
  byType: Record<string, number>;
  processedFiles: number;
}
