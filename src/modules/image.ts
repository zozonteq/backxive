import { Downloader } from '../core/downloader';
import type { Tweet, ImageDownloadResult } from '../types';
import { CONFIG } from '../config/constants';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getAllJsonFiles } from '../utils/file';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { ensureDirectoryExists } from '../utils/file';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadWithRetry(url: string, maxRetries = 3): Promise<{ status: string; arrayBuffer?: ArrayBuffer; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      
      if (response.status === 404) {
        return { status: 'not_found', error: '404 Not Found' };
      }
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 3000;
        await sleep(waitTime);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return { status: 'success', arrayBuffer };
    } catch (error) {
      if (attempt < maxRetries) {
        const waitTime = 3000;
        await sleep(waitTime);
      } else {
        return { status: 'error', error: (error as Error).message };
      }
    }
  }
  return { status: 'error', error: 'Max retries exceeded' };
}

if (!isMainThread) {
  const { images, threadId, downloadDir, waybackUrl } = workerData as { 
    images: string[], 
    threadId: number, 
    downloadDir: string,
    waybackUrl: string
  };
  
  (async () => {
    try {
      const results = [];
      for (const image of images) {
        try {
          const filename = image.split("/").pop();
          if (!filename) {
            results.push({ success: false, filename: 'unknown', error: 'Invalid filename' });
            continue;
          }

          const filePath = join(downloadDir, filename);
          
          if (existsSync(filePath)) {
            results.push({ success: true, filename, skipped: true });
            continue;
          }

          const url = image.replace(
            "https://pbs.twimg.com/media/",
            `${waybackUrl}/https://pbs.twimg.com/media/`
          );
          
          const result = await downloadWithRetry(url);
          
          if (result.status === 'not_found') {
            results.push({ success: false, filename, error: result.error, not_found: true });
            continue;
          }
          
          if (result.status === 'error') {
            results.push({ success: false, filename, error: result.error });
            continue;
          }
          
          if (!result.arrayBuffer) {
            throw new Error('Invalid arrayBuffer');
          }

          await Bun.write(filePath, result.arrayBuffer);
          results.push({ success: true, filename });
          
          await sleep(5000);
        } catch (error) {
          results.push({ success: false, filename: image.split("/").pop(), error: (error as Error).message });
        }
      }

      parentPort?.postMessage({
        threadId,
        results
      });
    } catch (error) {
      console.error(`[Worker ${threadId}] Error in worker thread:`, error);
      process.exit(1);
    }
  })();
}

export class ImageModule extends Downloader {
  private readonly NUM_THREADS = 3;
  private readonly DOWNLOAD_DIR = 'attaches'; // Consider making this configurable

  // Type for progress updates
  type ImageProcessingProgress = {
    stage: 'initializing' | 'scanning_files' | 'scan_complete' | 'worker_update' | 'worker_error' | 'summary' | 'complete' | 'error';
    processed?: number; // Files scanned or images processed by workers
    total?: number;     // Total files to scan or total images to download
    message?: string;
    error?: string;
    threadId?: number;
    // Fields for worker results aggregation
    totalSuccess?: number;
    totalNotFound?: number;
    totalError?: number;
    totalSkipped?: number; // For images already existing
  };


  // Constructor might not need listFile if processAllImages always scans the directory.
  // Or, it could take a base data path. For now, matching existing.
  constructor(listFile?: string) { // Made listFile optional
    super(listFile || ''); // Pass empty string if not provided, Downloader might need adjustment
    ensureDirectoryExists(this.DOWNLOAD_DIR);
  }

  async processAllImages(
    username: string,
    onProgress?: (progress: ImageProcessingProgress) => void
  ): Promise<string> {
    onProgress?.({ stage: 'initializing', message: `Processing images for @${username}...` });

    try {
      const tweetsDir = CONFIG.PATHS.TWEETS_DIR; // Ensure this path is correct and accessible
      const jsonFiles = getAllJsonFiles(tweetsDir);
      
      onProgress?.({ stage: 'scanning_files', total: jsonFiles.length, processed: 0, message: `Found ${jsonFiles.length} tweet files to process.` });
      
      const allImageUrls: string[] = [];
      let filesScanned = 0;
      
      for (const file of jsonFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const tweet: Tweet = JSON.parse(content);

          // Filter by username - ensuring it's the primary user of the tweet
          if (tweet.includes?.users?.[0]?.username.toLowerCase() === username.toLowerCase()) {
            const imageUrls = this.extractImageUrls(tweet);
            if (imageUrls.length > 0) {
              allImageUrls.push(...imageUrls);
            }
          }
        } catch (parseError) {
          onProgress?.({ stage: 'error', error: `Error parsing tweet file ${file}: ${(parseError as Error).message}`});
          // Decide if one parse error should stop all, or just skip this file. Skipping for now.
        }
        filesScanned++;
        if (filesScanned % 100 === 0 || filesScanned === jsonFiles.length) {
          onProgress?.({ stage: 'scanning_files', processed: filesScanned, total: jsonFiles.length, message: `Scanned ${filesScanned}/${jsonFiles.length} files...` });
        }
      }
      
      const uniqueImageUrls = Array.from(new Set(allImageUrls));
      onProgress?.({ stage: 'scan_complete', total: uniqueImageUrls.length, message: `Scan complete. Found ${uniqueImageUrls.length} unique images to download.` });
      
      if (uniqueImageUrls.length === 0) {
        const message = 'No images found to download for this user or matching criteria.';
        onProgress?.({ stage: 'complete', message });
        return message;
      }

      // Worker thread logic for downloading
      if (!isMainThread) { // Should not happen if called from GUI, but good check.
        throw new Error("processAllImages should only be called from the main thread.");
      }

      const chunkSize = Math.ceil(uniqueImageUrls.length / this.NUM_THREADS);
      const chunks = [];
      for (let i = 0; i < uniqueImageUrls.length; i += chunkSize) {
        chunks.push(uniqueImageUrls.slice(i, i + chunkSize));
      }

      onProgress?.({ stage: 'initializing', message: `Starting image download with ${this.NUM_THREADS} threads for ${uniqueImageUrls.length} images...` });
      
      let completedThreads = 0;
      let overallSuccess = 0;
      let overallNotFound = 0;
      let overallError = 0;
      let overallSkipped = 0; // To count skipped images
      
      const workers = chunks.map((chunk, index) => {
        return new Promise<void>((resolve, reject) => {
          const worker = new Worker(__filename, {
            workerData: { 
              images: chunk, 
              threadId: index,
              downloadDir: this.DOWNLOAD_DIR,
              waybackUrl: CONFIG.WAYBACK.BASE_URL
            }
          });

          worker.on('message', (msg: { threadId: number, results: ImageDownloadResult[] }) => {
            const successCount = msg.results.filter(r => r.success && !r.skipped).length;
            const skippedCount = msg.results.filter(r => r.success && r.skipped).length;
            const notFoundCount = msg.results.filter(r => r.not_found).length;
            // Errors are items that are not success, not skipped, and not 'not_found'
            const errorCount = msg.results.filter(r => !r.success && !r.skipped && !r.not_found).length;
            
            overallSuccess += successCount;
            overallSkipped += skippedCount;
            overallNotFound += notFoundCount;
            overallError += errorCount;
            
            completedThreads++;
            onProgress?.({
              stage: 'worker_update',
              threadId: msg.threadId,
              message: `Thread ${msg.threadId} completed. Images: ${chunk.length} (S: ${successCount}, K: ${skippedCount}, NF: ${notFoundCount}, E: ${errorCount})`,
              processed: completedThreads, // Number of threads completed
              total: this.NUM_THREADS,    // Total number of threads
              totalSuccess: overallSuccess,
              totalSkipped: overallSkipped,
              totalNotFound: overallNotFound,
              totalError: overallError
            });
            resolve(); // Resolve promise when worker is done and message processed
          });

          worker.on('error', (err) => {
            onProgress?.({ stage: 'worker_error', threadId: index, error: err.message });
            // Decide if one worker error rejects all. For now, it does.
            reject(err);
          });

          worker.on('exit', (code) => {
            if (code !== 0) {
              const errMessage = `Worker ${index} stopped with exit code ${code}`;
              onProgress?.({ stage: 'worker_error', threadId: index, error: errMessage });
              reject(new Error(errMessage));
            }
            // Resolve is handled on 'message' to ensure results are processed.
            // If a worker exits without a message (e.g. due to an unhandled exception in worker init),
            // this promise might hang if not also handled here. However, 'error' event should cover that.
          });
        });
      });

      try {
        await Promise.all(workers);
        const summaryMessage = `Download Summary: Total unique images: ${uniqueImageUrls.length}. ` +
                               `Successfully downloaded: ${overallSuccess}. Skipped (already exist): ${overallSkipped}. ` +
                               `Not found (404): ${overallNotFound}. Failed: ${overallError}.`;
        onProgress?.({
          stage: 'summary',
          message: summaryMessage,
          totalSuccess: overallSuccess,
          totalSkipped: overallSkipped,
          totalNotFound: overallNotFound,
          totalError: overallError,
          processed: uniqueImageUrls.length, // Total images attempted
          total: uniqueImageUrls.length
        });
        onProgress?.({ stage: 'complete', message: 'All image downloads attempted.' });
        return summaryMessage;
      } catch (error) {
        const errorMessage = `Error during multi-threaded image download: ${(error as Error).message}`;
        onProgress?.({ stage: 'error', error: errorMessage });
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Failed to process images for @${username}: ${(error as Error).message}`;
      onProgress?.({ stage: 'error', error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  private extractImageUrls(tweet: Tweet): string[] { // Made private as it's an internal helper
    if (!tweet.includes?.media?.length) return [];
    if (tweet.data.text.includes("RT @")) return [];

    return tweet.includes.media
      .filter((media: { url?: string }) => media.url !== undefined)
      .map((media: { url?: string }) => media.url as string)
  }
} 