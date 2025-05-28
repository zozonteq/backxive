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

  // processTweet remains largely the same but we remove direct console.log for external progress handling
  async processTweet(item: [string, string], usernameForPath: string): Promise<DownloadResult> {
    const url = `${CONFIG.WAYBACK.BASE_URL}/${item[0]}id_/${item[1]}`;
    // Progress reporting will be handled in processAllTweets

    try {
      const date = parseWaybackTimestamp(item[0]);
      // The isAfter2022May check seems specific and might need review for general use.
      // For now, let's assume it's a valid business rule.
      // if (!this.isAfter2022May(date)) {
      //   return { success: false, error: `Skipping ${item[1]} (before May 2023)` };
      // }

      const response = await this.fetchWithRetry(url);
      const data = await response.json();

      // Assuming data.data contains the tweet object; this needs robust validation in a real app
      if (!data.data || !data.data.id || !data.data.author_id) {
        return { success: false, error: `Invalid tweet data structure for ${item[1]}` };
      }
      // data.data directly corresponds to the 'data' part of the Tweet interface
      const tweetPayload: Tweet['data'] = data.data; 
      
      // Use the provided username to construct the path
      const filePath = getTweetPath(date, tweetPayload.id, usernameForPath);
      
      // Save the entire original data structure fetched, which includes 'data', 'includes', etc.
      await Bun.write(filePath, JSON.stringify(data, null, 2));
      
      return { success: true, path: filePath };
    } catch (error) {
      // Error logging will be handled in processAllTweets through onProgress
      return { success: false, error: `Error processing ${item[1]}: ${(error as Error).message}` };
    }
  }

  async processAllTweets(
    listFilePath: string,
    username: string, // Added username to correctly form file paths via getTweetPath
    onProgress?: (progress: { processed: number; total: number; currentItem?: string; success?: boolean; error?: string, path?: string }) => void
  ): Promise<string> {
    let items: [string, string][];
    try {
      const fileContent = await Bun.file(listFilePath).text();
      const jsonData = JSON.parse(fileContent);
      // Assuming the list file is an array of [timestamp, original] tuples,
      // potentially with a header row if it's from the initial CDX search.
      // If there's a header (e.g. ["timestamp", "original"]), skip it.
      if (Array.isArray(jsonData) && jsonData.length > 0 && Array.isArray(jsonData[0]) && jsonData[0][0] === "timestamp") {
        items = jsonData.slice(1) as [string, string][];
      } else if (Array.isArray(jsonData)) {
        items = jsonData as [string, string][];
      } else {
        throw new Error("Invalid list file format: Expected an array of [timestamp, original] tuples.");
      }
    } catch (error) {
      throw new Error(`Failed to read or parse list file ${listFilePath}: ${(error as Error).message}`);
    }

    if (!items || items.length === 0) {
      return "No items found in the list file to process.";
    }

    const totalItems = items.length;
    let successes = 0;
    let failures = 0;

    onProgress?.({ processed: 0, total: totalItems, currentItem: "Starting..." });

    for (let i = 0; i < totalItems; i++) {
      const item = items[i];

      // Check if item is valid and is a [string, string] tuple
      if (item && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
        const result = await this.processTweet(item, username); // Pass username
        
        if (result.success) {
          successes++;
          onProgress?.({ processed: i + 1, total: totalItems, currentItem: item[1], success: true, path: result.path });
        } else {
          failures++;
          onProgress?.({ processed: i + 1, total: totalItems, currentItem: item[1], success: false, error: result.error });
        }
      } else {
        // Handle invalid/undefined item
        failures++;
        onProgress?.({
          processed: i + 1,
          total: totalItems,
          currentItem: 'Invalid/Malformed item data', // More descriptive
          success: false,
          error: 'Skipped invalid or malformed item in list file.'
        });
      }
    }

    const summary = `Tweet processing complete. Total: ${totalItems}, Successes: ${successes}, Failures: ${failures}.`;
    onProgress?.({ processed: totalItems, total: totalItems, currentItem: "Finished", success: true }); // Final progress update
    return summary;
  }
}