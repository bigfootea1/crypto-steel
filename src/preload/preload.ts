import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ticker', {
  onTickerUpdate: (callback: (tickerData: any) => void) => { 
    ipcRenderer.on('ticker-update', (evt, data) => callback(data));
  }
});