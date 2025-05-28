// This file is loaded by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// Augment the Window interface to include the API exposed by the preload script
interface ExtendedWindow extends Window {
  myAPI?: {
    doSomething: () => void;
  };
}

// Cast window to our extended interface
const extendedWindow = window as ExtendedWindow;

document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username') as HTMLInputElement;
  const listFilePathInput = document.getElementById('listFilePathInput') as HTMLInputElement;
  const outputArea = document.getElementById('outputArea');

  const btnGenerateList = document.getElementById('btnGenerateList');
  const btnDownloadTweets = document.getElementById('btnDownloadTweets');
  const btnDownloadImages = document.getElementById('btnDownloadImages');

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

  if (btnGenerateList) {
    btnGenerateList.addEventListener('click', () => {
      const username = usernameInput ? usernameInput.value : 'N/A';
      const listPath = listFilePathInput ? listFilePathInput.value : 'N/A';
      const message = `Action: Generate List. Username: ${username}, List File Path: ${listPath}`;
      displayMessage(message);
      console.log(message);
      // Placeholder for actual functionality
    });
  }

  if (btnDownloadTweets) {
    btnDownloadTweets.addEventListener('click', () => {
      const username = usernameInput ? usernameInput.value : 'N/A';
      // listFilePathInput might not be relevant for downloading all tweets for a user,
      // but we'll retrieve it for consistency in this example.
      const listPath = listFilePathInput ? listFilePathInput.value : 'N/A';
      const message = `Action: Download Tweets. Username: ${username}, List File Path (if applicable): ${listPath}`;
      displayMessage(message);
      console.log(message);
      // Placeholder for actual functionality
    });
  }

  if (btnDownloadImages) {
    btnDownloadImages.addEventListener('click', () => {
      const username = usernameInput ? usernameInput.value : 'N/A';
      // listFilePathInput might not be relevant for downloading all images for a user.
      const listPath = listFilePathInput ? listFilePathInput.value : 'N/A';
      const message = `Action: Download Images. Username: ${username}, List File Path (if applicable): ${listPath}`;
      displayMessage(message);
      console.log(message);
      // Placeholder for actual functionality
    });
  }

  // Example usage of the API exposed from preload.ts
  if (extendedWindow.myAPI && typeof extendedWindow.myAPI.doSomething === 'function') {
    try {
      extendedWindow.myAPI.doSomething();
      displayMessage('Called myAPI.doSomething() successfully.');
    } catch (error) {
      displayMessage(`Error calling myAPI.doSomething(): ${error}`, true);
    }
  } else {
    displayMessage('myAPI.doSomething is not available on window object.', true);
  }

  displayMessage('Renderer process script loaded and event listeners attached.');
});
