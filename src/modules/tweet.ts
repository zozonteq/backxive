import { Downloader } from '../core/downloader';
import { getTweetPath } from '../utils/file';
import type { Tweet, DownloadResult } from '../types';
import { CONFIG } from '../config/constants';
import { parseWaybackTimestamp } from '../utils/date';

export class TweetModule extends Downloader {
  private isAfter2022May(date: Date): boolean {
    return date.getFullYear() > 2023 || 
           (date.getFullYear() === 2023 && date.getMonth() >= 5);
  }

  async processTweet(item: [string, string]): Promise<DownloadResult> {
    const url = `${CONFIG.WAYBACK.BASE_URL}/${item[0]}id_/${item[1]}`;
    console.log(`Processing: ${url}`);

    try {
      const date = parseWaybackTimestamp(item[0]);
      if (!this.isAfter2022May(date)) {
        console.log(`Skipping ${item[1]} because it is before May 2023`);
        return { success: false, error: 'Skipping because it is before May 2023' };
      }

      const response = await this.fetchWithRetry(url);
      const data = await response.json();
      const tweet = data.data as Tweet;
      
      const filePath = getTweetPath(date, tweet.id, tweet.author_id);
      
      await Bun.write(filePath, JSON.stringify(data, null, 2));
      
      return { success: true, path: filePath };
    } catch (error) {
      console.error(`Error processing ${item[1]}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  async processAllTweets(): Promise<void> {
    const items = this.getItems();
    console.log(`Processing ${items.length} tweets...`);

    for (const item of items) {
      await this.processTweet(item);
    }
  }
} 