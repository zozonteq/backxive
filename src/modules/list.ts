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
    this.listFile = `list_${username}.json`;
  }

  async generateList(): Promise<void> {
    console.log(`Generating list for @${this.username}...`);
    
    const url = `http://web.archive.org/cdx/search/cdx?url=twitter.com/${this.username}*&output=json&fl=timestamp,original&collapse=urlkey`;
    if(existsSync(this.listFile)) {
      console.log(`List file ${this.listFile} already exists. Skipping generation.`);
      return;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      
      const data = await response.json();
      writeFileSync(this.listFile, JSON.stringify(data, null, 2));
      
      console.log(`List generated: ${this.listFile}`);
      console.log(`Next step: download tweets from ${this.listFile}`);
    } catch (error) {
      throw new Error(`Failed to generate list: ${(error as Error).message}`);
    }
  }
} 