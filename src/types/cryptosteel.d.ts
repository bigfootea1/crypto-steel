export interface ITickerAPI {
    on(channelName: string, callback: (event: any, message: any) => void): Electron.IpcRenderer;
    off(channelName: string, callback: (event: any, message: any) => void): Electron.IpcRenderer;

    sendState(state: any): void;
}

declare global {
    interface Window {
        ticker: ITickerAPI
    }
}