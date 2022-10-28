// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

// preload with contextIsolation enabled
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('tickerAPI', {
  getCurrentData: () => {
    console.log('getCurrentData');
    return "FOOBAR!";
  }
});