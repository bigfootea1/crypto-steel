export interface ITickerAPI {
    onTickerUpdate(callback: (tickerData: any) => void): Electron.IpcRenderer;
    onTickerConfigChange(callback: (tickerConfig: any) => void): Electron.IpcRenderer;
}

declare global {
    interface Window {
        ticker: ITickerAPI
    }
}