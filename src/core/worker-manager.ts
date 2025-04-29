import { Worker } from 'worker_threads';
import { CONFIG } from '../config/constants';
import { WorkerData, WorkerResult } from '../types';

export class WorkerManager {
  private workers: Promise<void>[] = [];

  constructor(private workerFile: string) {}

  async processItems<T>(items: T[], processFn: (item: T) => Promise<any>): Promise<void> {
    const chunkSize = Math.ceil(items.length / CONFIG.WORKER.THREAD_COUNT);
    const chunks: T[][] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    this.workers = chunks.map((chunk, index) => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(this.workerFile, {
          workerData: { items: chunk, threadId: index } as WorkerData
        });

        worker.on('message', (result: WorkerResult) => {
          console.log(`Thread ${result.threadId} completed:`, result);
        });

        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          } else {
            resolve();
          }
        });
      });
    });

    await Promise.all(this.workers);
    console.log('All workers completed');
  }
} 