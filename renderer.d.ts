export interface ITickerAPI {
    getCurrentData: () => any,
}
  
declare global {
    interface Window {
        tickerAPI: ITickerAPI
    }
}