
// Interface for knowledge entries
export interface KnowledgeEntry {
  type: 'comment' | 'function' | 'export' | 'content' | 'page' | 'config';
  content: string;
  filePath: string;
  metadata?: Record<string, any>;
  keywords: string[];
  lastUpdated?: string;
}

// Knowledge base statistics interface
export interface KnowledgeBaseStats {
  totalEntries: number;
  byType: {
    comment: number;
    function: number;
    export: number;
    content: number;
    page: number;
    config: number;
  };
  processedFiles: number;
  contentCounts?: {
    posts: number;
    pages: number;
    files: number;
    totalContent: number;
  };
}

// Content metadata interface
export interface ContentMetadata {
  title?: string;
  date?: string;
  tags?: string[];
  description?: string;
  contentType?: 'blog post' | 'page' | 'article' | 'documentation';
  wordCount?: number;
  lastModified?: string;
}

// Page routing metadata interface
export interface PageRoutingMetadata {
  route?: string;
  type?: 'page' | 'layout' | 'loading' | 'error' | 'api';
  dynamic?: boolean;
  params?: string[];
}

// CMS configuration metadata interface
export interface CMSConfigMetadata {
  platform?: string;
  contentTypes?: string[];
  collections?: string[];
  pageCount?: number;
  version?: string;
}
