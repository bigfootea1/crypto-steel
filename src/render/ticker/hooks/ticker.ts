import { useEffect, useState } from "react";
import { EmptyUpdate, TickerUpdate } from "../../../types/ticker";
import debounce from 'lodash/debounce';

export function useTicker(tickerBase: string): TickerUpdate {
  const [update, setUpdate] = useState<TickerUpdate>(EmptyUpdate);

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
