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
  private readonly DOWNLOAD_DIR = 'attaches';

  constructor(listFile: string) {
    super(listFile);
    ensureDirectoryExists(this.DOWNLOAD_DIR);
  }

  async processAllImages(username: string): Promise<void> {
    console.log(`Processing images for ${username}...`);
    try {
      const tweetsDir = CONFIG.PATHS.TWEETS_DIR;
      const jsonFiles = getAllJsonFiles(tweetsDir);
      
      console.log(`Found ${jsonFiles.length} tweet files to process`);
      
      const allImageUrls: string[] = [];
      let processedFiles = 0;
      
      for (const file of jsonFiles) {
        const content = await readFile(file, 'utf-8');
        const tweet: Tweet = JSON.parse(content);

        if(tweet.includes?.users?.[0]?.username.toLowerCase() !== username.toLowerCase()) {
          // ユーザー名が一致しない場合はスキップ
          continue;
        }

        
        const imageUrls = this.extractImageUrls(tweet);
        if (imageUrls.length > 0) {
          allImageUrls.push(...imageUrls);
        }
        processedFiles++;
        
        if (processedFiles % 100 === 0) {
          console.log(`Processed ${processedFiles}/${jsonFiles.length} files...`);
        }
      }
      
      console.log(`Total images found: ${allImageUrls.length}`);
      
      if (allImageUrls.length === 0) {
        console.log('No images found to download');
        return;
      }

      if (isMainThread) {
        const chunkSize = Math.ceil(allImageUrls.length / this.NUM_THREADS);
        const chunks = [];
        for (let i = 0; i < allImageUrls.length; i += chunkSize) {
          chunks.push(allImageUrls.slice(i, i + chunkSize));
        }

        console.log(`Starting download with ${this.NUM_THREADS} threads...`);
        
        let completedThreads = 0;
        let totalSuccess = 0;
        let totalNotFound = 0;
        let totalError = 0;
        
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

            worker.on('message', (result: { results: ImageDownloadResult[] }) => {
              const successCount = result.results.filter((r: ImageDownloadResult) => r.success).length;
              const notFoundCount = result.results.filter((r: ImageDownloadResult) => r.error === '404 Not Found').length;
              const errorCount = result.results.filter((r: ImageDownloadResult) => !r.success && r.error !== '404 Not Found').length;
              
              totalSuccess += successCount;
              totalNotFound += notFoundCount;
              totalError += errorCount;
              
              completedThreads++;
              console.log(`Thread ${index} completed: ${successCount} succeeded, ${notFoundCount} not found, ${errorCount} failed`);
              console.log(`Progress: ${completedThreads}/${this.NUM_THREADS} threads completed`);
            });

            worker.on('error', (error) => {
              console.error(`Thread ${index} error:`, error);
              reject(error);
            });

            worker.on('exit', (code) => {
              if (code !== 0) {
                console.error(`Worker ${index} stopped with exit code ${code}`);
                reject(new Error(`Worker ${index} stopped with exit code ${code}`));
              } else {
                resolve();
              }
            });
          });
        });

        try {
          await Promise.all(workers);
          console.log('\nDownload Summary:');
          console.log(`Total images: ${allImageUrls.length}`);
          console.log(`Successfully downloaded: ${totalSuccess}`);
          console.log(`Not found: ${totalNotFound}`);
          console.log(`Failed: ${totalError}`);
          console.log('All downloads completed!');
        } catch (error) {
          console.error('Error during download:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error(`Failed to process images:`, error);
      throw error;
    }
  }

  extractImageUrls(tweet: Tweet): string[] {
    if (!tweet.includes?.media?.length) return [];
    if (tweet.data.text.includes("RT @")) return [];

    return tweet.includes.media
      .filter((media: { url?: string }) => media.url !== undefined)
      .map((media: { url?: string }) => media.url as string)
  }
} 