// This file is loaded by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// Augment the Window interface to include the API exposed by the preload script
// Define a type for the progress data for clarity
type TweetDownloadProgress = {
  processed: number;
  total: number;
  currentItem?: string;
  success?: boolean;
  error?: string;
  path?: string;
};

// Define a type for Image Processing Progress data for clarity
// This should ideally match or be compatible with ImageProcessingProgress in image.ts
type ImageProcessingProgress = {
  stage: 'initializing' | 'scanning_files' | 'scan_complete' | 'worker_update' | 'worker_error' | 'summary' | 'complete' | 'error';
  processed?: number;
  total?: number;
  message?: string;
  error?: string;
  threadId?: number;
  totalSuccess?: number;
  totalNotFound?: number;
  totalError?: number;
  totalSkipped?: number;
};


interface ExtendedWindow extends Window {
  electronAPI?: {
    doSomething: () => void;
    generateList: (username: string) => Promise<{ success?: string; error?: string }>;
    downloadTweets: (listFilePath: string, username: string) => Promise<{ success?: string; error?: string }>;
    onDownloadTweetsProgress: (callback: (progress: TweetDownloadProgress) => void) => () => void;
    downloadImages: (username: string) => Promise<{ success?: string; error?: string }>;
    onImageDownloadProgress: (callback: (progress: ImageProcessingProgress) => void) => () => void; // Returns a cleanup function
  };
}

// Cast window to our extended interface
const extendedWindow = window as ExtendedWindow;

document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username') as HTMLInputElement | null;
  const listFilePathInput = document.getElementById('listFilePathInput') as HTMLInputElement | null;
  const outputArea = document.getElementById('outputArea') as HTMLDivElement | null;

  const btnGenerateList = document.getElementById('btnGenerateList') as HTMLButtonElement | null;
  const btnDownloadTweets = document.getElementById('btnDownloadTweets') as HTMLButtonElement | null;
  const btnDownloadImages = document.getElementById('btnDownloadImages') as HTMLButtonElement | null;

  const actionButtons: (HTMLButtonElement | null)[] = [btnGenerateList, btnDownloadTweets, btnDownloadImages];

  function setActionButtonsDisabled(disabled: boolean): void {
    actionButtons.forEach(button => {
      if (button) {
        button.disabled = disabled;
      }
    });
  }

  function clearOutputArea(): void {
    if (outputArea) {
      outputArea.innerHTML = ''; // Clear previous messages
    }
  }

  function displayMessage(message: string, isError: boolean = false): void {
    if (outputArea) {
      const messageElement = document.createElement('div');
      messageElement.textContent = message;
      if (isError) {
        messageElement.style.color = 'red';
      }
      outputArea.appendChild(messageElement);
      // Scroll to the bottom of the output area
      outputArea.scrollTop = outputArea.scrollHeight;
    }
    console.log(message); // Also log to console
  }

  if (btnGenerateList && usernameInput) {
    btnGenerateList.addEventListener('click', async () => {
      clearOutputArea();
      const username = usernameInput.value.trim();
      if (!username) {
        displayMessage('Username is required for generating a list.', true);
        return;
      }

      setActionButtonsDisabled(true);
      displayMessage(`Attempting to generate list for @${username}...`);

      if (extendedWindow.electronAPI && extendedWindow.electronAPI.generateList) {
        try {
          const result = await extendedWindow.electronAPI.generateList(username);
          if (result.success) {
            displayMessage(`Success: ${result.success}`);
          } else if (result.error) {
            displayMessage(`Error: ${result.error}`, true);
          } else {
            displayMessage('Received an unexpected response from generateList.', true);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          displayMessage(`An error occurred while calling generateList: ${errorMessage}`, true);
        } finally {
          setActionButtonsDisabled(false);
        }
      } else {
        displayMessage('generateList function is not available on window.electronAPI.', true);
        setActionButtonsDisabled(false);
      }
    });
  }

  if (btnDownloadTweets && usernameInput && listFilePathInput) {
    btnDownloadTweets.addEventListener('click', async () => {
      clearOutputArea();
      const username = usernameInput.value.trim();
      const listPath = listFilePathInput.value.trim();

      if (!username) {
        displayMessage('Username is required for downloading tweets.', true);
        return;
      }
      if (!listPath) {
        displayMessage('List File Path is required for downloading tweets.', true);
        return;
      }

      setActionButtonsDisabled(true);
      displayMessage(`Attempting to download tweets for @${username} using list: ${listPath}...`);

      if (extendedWindow.electronAPI && extendedWindow.electronAPI.downloadTweets && extendedWindow.electronAPI.onDownloadTweetsProgress) {
        let removeProgressListener: (() => void) | null = null;

        try {
          removeProgressListener = extendedWindow.electronAPI.onDownloadTweetsProgress((progress) => {
            // For ongoing progress, typically we don't clear the whole output area,
            // but displayMessage appends. This is fine.
            let progressMessage = `Progress: ${progress.processed}/${progress.total}`;
            if (progress.currentItem) {
              progressMessage += ` - Current: ${progress.currentItem}`;
            }
            if (progress.success === true && progress.path) {
              progressMessage += ` - Success: ${progress.path}`;
            } else if (progress.success === false && progress.error) {
              progressMessage += ` - Error: ${progress.error}`;
            } else if (progress.error) { 
                progressMessage = `Error: ${progress.error}`;
                displayMessage(progressMessage, true);
                return; 
            }
            displayMessage(progressMessage, progress.success === false && !!progress.error);
          });

          const result = await extendedWindow.electronAPI.downloadTweets(listPath, username);

          if (result.success) {
            displayMessage(`Final Result: ${result.success}`);
          } else if (result.error) {
            displayMessage(`Final Error: ${result.error}`, true);
          } else {
            displayMessage('Received an unexpected final response from downloadTweets.', true);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          displayMessage(`An error occurred while calling downloadTweets: ${errorMessage}`, true);
        } finally {
          if (removeProgressListener) {
            removeProgressListener();
            displayMessage('Tweet download process finished. Progress listener removed.');
          }
          setActionButtonsDisabled(false);
        }
      } else {
        displayMessage('Tweet download functions are not available on window.electronAPI.', true);
        setActionButtonsDisabled(false);
      }
    });
  }

  if (btnDownloadImages && usernameInput) {
    btnDownloadImages.addEventListener('click', async () => {
      clearOutputArea();
      const username = usernameInput.value.trim();

      if (!username) {
        displayMessage('Username is required for downloading images.', true);
        return;
      }
      
      setActionButtonsDisabled(true);
      displayMessage(`Attempting to download images for @${username}...`);

      if (extendedWindow.electronAPI && extendedWindow.electronAPI.downloadImages && extendedWindow.electronAPI.onImageDownloadProgress) {
        let removeProgressListener: (() => void) | null = null;

        try {
          removeProgressListener = extendedWindow.electronAPI.onImageDownloadProgress((progress) => {
            let progressMessage = `Image Download [${progress.stage}]: `;
            if (progress.message) {
              progressMessage += progress.message;
            } else if (progress.error) {
              progressMessage += `Error: ${progress.error}`;
            } else {
              progressMessage += `Processed ${progress.processed || 0}/${progress.total || '?'}`;
              if (progress.stage === 'worker_update') {
                progressMessage += ` (Threads done: ${progress.processed}/${progress.total})`;
                progressMessage += ` Stats: Success: ${progress.totalSuccess}, Skipped: ${progress.totalSkipped}, Not Found: ${progress.totalNotFound}, Errors: ${progress.totalError}`;
              }
            }
            displayMessage(progressMessage, progress.stage === 'error' || progress.stage === 'worker_error');
          });

          const result = await extendedWindow.electronAPI.downloadImages(username);

          if (result.success) {
            displayMessage(`Image Download Final Result: ${result.success}`);
          } else if (result.error) {
            displayMessage(`Image Download Final Error: ${result.error}`, true);
          } else {
            displayMessage('Received an unexpected final response from downloadImages.', true);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          displayMessage(`An error occurred while calling downloadImages: ${errorMessage}`, true);
        } finally {
          if (removeProgressListener) {
            removeProgressListener();
            displayMessage('Image download process finished. Progress listener removed.');
          }
          setActionButtonsDisabled(false);
        }
      } else {
        displayMessage('Image download functions are not available on window.electronAPI.', true);
        setActionButtonsDisabled(false);
      }
    });
  }

  // Example usage of the API exposed from preload.ts
  if (extendedWindow.electronAPI && typeof extendedWindow.electronAPI.doSomething === 'function') {
    try {
      extendedWindow.electronAPI.doSomething();
      displayMessage('Called electronAPI.doSomething() successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      displayMessage(`Error calling electronAPI.doSomething(): ${errorMessage}`, true);
    }
  } else {
    displayMessage('electronAPI.doSomething is not available on window object.', true);
  }

  displayMessage('Renderer process script loaded and event listeners attached.');
  if (!usernameInput) displayMessage('Warning: Username input field not found.', true);
  if (!listFilePathInput) displayMessage('Warning: List File Path input field not found.', true);
  if (!outputArea) displayMessage('Warning: Output area not found.', true);
  if (!btnGenerateList) displayMessage('Warning: Generate List button not found.', true);
  if (!btnDownloadTweets) displayMessage('Warning: Download Tweets button not found.', true);
  if (!btnDownloadImages) displayMessage('Warning: Download Images button not found.', true);
});
