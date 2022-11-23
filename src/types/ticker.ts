/// Kracken Ticker update
export type TickerUpdate = {
  starttime: number;
  endtime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
  base: string;
  quote: string;
  interval: number;
  channel: string;
};

/// Kracken Candle update
export type CandleUpdate = {
  endtime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
};

/// Configuration info
export type TickerConfig = {
  base: string[];
  quote: string;
};

/// A single Ticker base/quote combo
export type TickerPair = {
  base: string; 
  quote: string;  
};

/// Initial ticker update state
export const EmptyUpdate: TickerUpdate = {
    starttime: 0,
    endtime: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    vwap: 0,
    volume: 0,    
    base: "",
    quote: "",
    interval: 0,
    channel: ''
};

/// Initial candle update state
// export const EmptyCandleUpdate: CandleUpdate = {
//   endtime: 0,
//   open: 0,
//   high: 0,
//   low: 0,
//   close: 0,
//   vwap: 0,
//   volume: 0
// };