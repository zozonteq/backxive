import { existsSync, writeFileSync } from 'fs';
import { CONFIG } from '../config/constants';

export class ListModule {
  private username: string;
  private listFile: string;

  constructor(username: string) {
    if (!username) {
      throw new Error('Username cannot be empty');
    }
    this.username = username;
    this.listFile = `list_${username}.json`; // Consider making this path configurable or relative to a data directory
  }

  async generateList(): Promise<string> {
    const url = `http://web.archive.org/cdx/search/cdx?url=twitter.com/${this.username}*&output=json&fl=timestamp,original&collapse=urlkey`;
    
    if (existsSync(this.listFile)) {
      return `List file ${this.listFile} already exists. Skipping generation.`;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data from Wayback Machine: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid or empty data received from Wayback Machine.');
      }
      writeFileSync(this.listFile, JSON.stringify(data, null, 2));
      
      return `List generated successfully: ${this.listFile}. Contains ${data.length} entries. Next step: download tweets.`;
    } catch (error) {
      // Ensure a consistent error format
      if (error instanceof Error) {
        throw new Error(`Failed to generate list for @${this.username}: ${error.message}`);
      }
      throw new Error(`Failed to generate list for @${this.username}: An unknown error occurred.`);
    }
  }
}