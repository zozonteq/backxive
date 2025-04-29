import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config/constants';

export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function getTweetPath(date: Date, tweetId: string, authorId: string): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const baseDir = CONFIG.PATHS.TWEETS_DIR;
  const dayDir = join(baseDir, year, `${year}-${month}`, `${year}-${month}-${day}`);
  ensureDirectoryExists(dayDir);
  
  return join(dayDir, `${tweetId}_${authorId}.json`);
}

export function getAllJsonFiles(dirPath: string): string[] {
  const files: string[] = [];
  
  function traverseDirectory(currentPath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        traverseDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  
  traverseDirectory(dirPath);
  return files;
} 