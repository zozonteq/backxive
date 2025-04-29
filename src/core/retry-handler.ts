import { CONFIG } from '../config/constants';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: () => Promise<T>,
  onError?: (error: Error, attempt: number) => void
): Promise<T> {
  for (let attempt = 1; attempt <= CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (onError) {
        onError(error as Error, attempt);
      }
      
      if (attempt < CONFIG.RETRY.MAX_ATTEMPTS) {
        await sleep(CONFIG.RETRY.DELAY_MS);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retry attempts reached');
} 