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

// Example of exposing a simple API to the renderer process
contextBridge.exposeInMainWorld('myAPI', {
  doSomething: () => {
    console.log('doSomething called from renderer process');
    // Example of sending a message to the main process
    ipcRenderer.send('some-event', 'some-data');
  },
  // You can expose other functions or properties here
});

console.log('Preload script loaded.');
