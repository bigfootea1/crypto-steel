import { useEffect, useState } from "react";
import { TickerUpdate } from "../../../types/ticker";
import debounce from 'lodash/debounce';

export function useTicker(tickerBase: string): TickerUpdate {
  const [update, setUpdate] = useState<TickerUpdate>({
    open: 0,
    close: 0,
    diff: 0,
    delta: 0,
    base: "",
    quote: "",
  });

  useEffect(() => {
    const debouncedUpdate = debounce(setUpdate, 1000);
    const handleUpdate = (event: any, tickerData: TickerUpdate) => debouncedUpdate(tickerData);
    window.ticker.on(`ticker-update-${tickerBase}`.toLowerCase(), handleUpdate);
    return () => {
      window.ticker.off(`ticker-update-${tickerBase}`.toLowerCase(), handleUpdate);
    };
  }, [tickerBase]);

  return update;
}
