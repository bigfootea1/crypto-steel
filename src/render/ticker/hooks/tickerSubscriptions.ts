import concat from "lodash/concat";
import reject from "lodash/reject";
import sortBy from "lodash/sortBy";
import { useEffect, useReducer } from "react";
import { TickerPair } from "../../../types/ticker";

type TickerSubAction = {
  type: string;
  pair: TickerPair;
};

/// This hook handles the subscribe and unsubscribe messages from
/// the main process.  When a subscribe happens, the pair is added
/// to the current list.  When an unsub happens, it is removed.
export function useTickerSubscriptions(): TickerPair[] {
  const [pairs, dispatch] = useReducer(
    (state: TickerPair[], action: TickerSubAction) =>
      action.type === "sub"
        ? concat(state, action.pair)
        : reject(state, action.pair),
    []
  );

  useEffect(() => {
    const handleUnsubscription = (event: any, pair: TickerPair) =>
      dispatch({ type: "unsub", pair });
    const handleSubscription = (event: any, pair: TickerPair) =>
      dispatch({ type: "sub", pair });

    window.ticker.on("ticker-subscribe", handleSubscription);
    window.ticker.on("ticker-unsubscribe", handleUnsubscription);

    return () => {
      window.ticker.off("ticker-subscribe", handleSubscription);
      window.ticker.off("ticker-unsubscribe", handleUnsubscription);
    };
  }, []);

  return sortBy(pairs, 'base');
}
