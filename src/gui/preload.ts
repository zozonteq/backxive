import { contextBridge, ipcRenderer } from 'electron';

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions] || 'unknown');
  }
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  doSomething: () => { // Kept for example, can be removed if not used
    console.log('doSomething called from renderer process via electronAPI');
    ipcRenderer.send('some-event', 'some-data from electronAPI');
  },
  generateList: async (username: string): Promise<{ success?: string; error?: string }> => {
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { error: 'Username must be a non-empty string in preload.' };
    }
    try {
      const result = await ipcRenderer.invoke('generate-list', username);
      return result; // This should be { success: message } or { error: message } from main.ts
    } catch (error) {
      // Handle errors during the invoke call itself
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: `IPC call to 'generate-list' failed: ${errorMessage}` };
    }
  },
  downloadTweets: async (listFilePath: string, username: string): Promise<{ success?: string; error?: string }> => {
    if (!listFilePath || typeof listFilePath !== 'string' || listFilePath.trim() === '') {
      return { error: 'List file path must be a non-empty string in preload.' };
    }
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { error: 'Username must be a non-empty string in preload.' };
    }
    try {
      // Send both listFilePath and username as an object
      const result = await ipcRenderer.invoke('download-tweets', { listFilePath, username });
      return result; // This should be { success: message } or { error: message } from main.ts
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: `IPC call to 'download-tweets' failed: ${errorMessage}` };
    }
  },
  onDownloadTweetsProgress: (callback: (progress: any) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('download-tweets-progress', listener);
    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener('download-tweets-progress', listener);
    };
  },
  downloadImages: async (username: string): Promise<{ success?: string; error?: string }> => {
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { error: 'Username must be a non-empty string in preload for downloadImages.' };
    }
    try {
      const result = await ipcRenderer.invoke('download-images', username);
      return result; // This should be { success: message } or { error: message } from main.ts
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: `IPC call to 'download-images' failed: ${errorMessage}` };
    }
  },
  onImageDownloadProgress: (callback: (progress: any) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('download-images-progress', listener);
    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener('download-images-progress', listener);
    };
  }
  // You can expose other functions or properties here
});

console.log('Preload script loaded and electronAPI exposed with tweet and image download capabilities.');
