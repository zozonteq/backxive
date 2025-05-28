import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ListModule } from '../modules/list';
import { TweetModule } from '../modules/tweet';
import { ImageModule } from '../modules/image'; // Import ImageModule

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({ // Assign to the broader scope mainWindow
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    width: 800,
  });

  // and load the index.html of the app.
  // For now, let's assume it will be in the same directory or a 'renderer' subdirectory.
  // This will be adjusted later when we create the HTML file.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  createWindow();

  // IPC handler for generating the list
  ipcMain.handle('generate-list', async (event, username: string) => {
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { error: 'Username must be a non-empty string.' };
    }
    try {
      const listModule = new ListModule(username);
      const result = await listModule.generateList();
      return { success: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: `Error generating list for @${username}: ${errorMessage}` };
    }
  });

  // IPC handler for downloading tweets
  ipcMain.handle('download-tweets', async (event, { listFilePath, username }: { listFilePath: string, username: string }) => {
    if (!listFilePath || typeof listFilePath !== 'string' || listFilePath.trim() === '') {
      return { error: 'List file path must be a non-empty string.' };
    }
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { error: 'Username must be a non-empty string.' };
    }

    try {
      const tweetModule = new TweetModule(); // Assuming default constructor is fine
      const result = await tweetModule.processAllTweets(
        listFilePath,
        username,
        (progress) => {
          if (mainWindow) {
            mainWindow.webContents.send('download-tweets-progress', progress);
          }
        }
      );
      return { success: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Send final error progress update
      if (mainWindow) {
        mainWindow.webContents.send('download-tweets-progress', { processed: 0, total: 0, error: `Critical error: ${errorMessage}` });
      }
      return { error: `Error downloading tweets: ${errorMessage}` };
    }
  });

  // IPC handler for downloading images
  ipcMain.handle('download-images', async (event, username: string) => {
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return { error: 'Username must be a non-empty string.' };
    }

    try {
      // Pass a conventional list file name to ImageModule constructor, though processAllImages might not use it directly.
      const listFileName = `list_${username}.json`; 
      const imageModule = new ImageModule(listFileName); 
      const result = await imageModule.processAllImages(
        username,
        (progress) => { // Assuming ImageProcessingProgress type is defined in ImageModule
          if (mainWindow) {
            mainWindow.webContents.send('download-images-progress', progress);
          }
        }
      );
      return { success: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Send final error progress update
      if (mainWindow) {
        mainWindow.webContents.send('download-images-progress', { stage: 'error', error: `Critical error: ${errorMessage}` });
      }
      return { error: `Error downloading images for @${username}: ${errorMessage}` };
    }
  });

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
