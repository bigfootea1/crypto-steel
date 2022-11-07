export type TickerUpdate = {
  open: number;
  close: number;
  diff: number;
  delta: number;
  base: string;
  quote: string;
};

export type TickerConfig = {
  base: string[];
  quote: string;
  updateRate: number;
};

export type TickerPair = {
  base: string; 
  quote: string;  
};