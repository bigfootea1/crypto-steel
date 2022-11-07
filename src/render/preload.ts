import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ticker', {
  on(channelName: string, callback: (event: any, message: any) => void) {
    ipcRenderer.on(channelName, callback);
  },

  off(channelName: string, callback: (event: any, message: any) => void) {
    ipcRenderer.off(channelName, callback);
  },

  sendState: (data: any): void => { 
    ipcRenderer.send('render-state-change', data);
  }
});