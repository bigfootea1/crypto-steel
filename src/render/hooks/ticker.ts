import { useState, useEffect, useReducer } from "react";
import { TickerUpdate } from "../../types/ticker";

export function useTicker(tickerBase: string): TickerUpdate {
  const [update, setUpdate] = useState<TickerUpdate>({
    open: 0,
    close: 0,
    diff: 0,
    delta: 0,
    base: "",
    quote: "",
  });
  const [base] = useReducer((base: string) => base, tickerBase);

  useEffect(() => {
    const handleUpdate = (event: any, tickerData: TickerUpdate) => {
      console.log(`Ticker Update: ${JSON.stringify(tickerData, null, 2)}`);
      setUpdate(tickerData);
    };

    window.ticker.on(`ticker-update-${base}`.toLowerCase(), handleUpdate);
    return () => {
      window.ticker.off(`ticker-update-${base}`.toLowerCase(), handleUpdate);
    };
  }, []);

  return update;
}
