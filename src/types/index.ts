export interface Tweet {
  data: {
    id: string;
    author_id: string;
    created_at: string;
    text: string;
    attachments?: {
      media_keys?: string[];
    };
    entities?: {
      urls?: Array<{
        url: string;
        expanded_url: string;
        display_url: string;
        indices: [number, number];
      }>;
    };
    public_metrics?: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      bookmark_count: number;
      impression_count: number;
    };
  };
  includes?: {
    media?: Array<{
      url?: string;
      type: string;
      media_key: string;
    }>;
    users?: Array<{
      id: string;
      name: string;
      username: string;
    }>;
    tweets?: Array<{
      id: string;
      text: string;
    }>;
  };
}

export interface DownloadResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface ImageDownloadResult {
  success: boolean;
  filename?: string;
  error?: string;
  skipped?: boolean;
  not_found?: boolean;
}

export interface WorkerData {
  items: Array<[string, string]>;
  threadId: number;
  username?: string;
}

export interface WorkerResult {
  threadId: number;
  item?: string;
  result: DownloadResult | ImageDownloadResult;
} 