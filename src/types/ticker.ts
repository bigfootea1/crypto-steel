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

export type CandleUpdate = {
  endtime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
};

export type TickerConfig = {
  base: string[];
  quote: string;
};

export type TickerPair = {
  base: string; 
  quote: string;  
};

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