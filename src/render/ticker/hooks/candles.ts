import { useEffect, useState } from "react";
import sortBy from 'lodash/sortBy';

import { CandleUpdate } from "../../../types/ticker";

export function useCandles(candleBase: string): CandleUpdate[] {
  const [update, setUpdate] = useState<CandleUpdate[]>([]);

  useEffect(() => {
    const handleUpdate = (event: any, candleData: CandleUpdate[]) => setUpdate(sortBy(candleData, 'endtime'));
    window.ticker.on(`candle-update-${candleBase}`.toLowerCase(), handleUpdate);
    return () => {
      window.ticker.off(`candle-update-${candleBase}`.toLowerCase(), handleUpdate);
    };
  }, [candleBase]);

  return update;
}
