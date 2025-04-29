import { withRetry } from './retry-handler';
import { CONFIG } from '../config/constants';
import { existsSync, readFileSync } from 'fs';

export class Downloader {
  protected listFile?: string;
  protected items: Array<[string, string]> = [];

  constructor(listFile?: string) {
    if (listFile) {
      if (!existsSync(listFile)) {
        throw new Error(`List file ${listFile} not found`);
      }
      this.listFile = listFile;
      this.items = JSON.parse(readFileSync(listFile, 'utf-8'));
    }
  }

  protected async fetchWithRetry(url: string): Promise<Response> {
    return withRetry(
      async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      },
      (error, attempt) => {
        console.error(`Attempt ${attempt} failed for ${url}:`, error);
      }
    );
  }

  protected async downloadWithRetry(url: string): Promise<{ status: string; blob?: Blob; error?: string }> {
    try {
      const response = await this.fetchWithRetry(url);
      if (response.status === 404) {
        return { status: 'not_found', error: '404 Not Found' };
      }
      const blob = await response.blob();
      return { status: 'success', blob };
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }

  getItems(): Array<[string, string]> {
    return this.items;
  }
} 