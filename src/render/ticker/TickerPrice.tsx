import React, { FC } from "react";
import { useTicker } from "./hooks/ticker";

import "./css/ticker-price.css";

interface TickerPriceProps {
  base: string;
  quote: string;
}

export const TickerPrice: FC<TickerPriceProps> = ({ base, quote }) => {
  const ticker = useTicker(base);

  let priceStr: string;
  try {
    priceStr = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: quote,
      maximumFractionDigits: 2,
    }).format(ticker.close);
  } catch (err) {
    priceStr = new Intl.NumberFormat("en-US", {
      style: "decimal",
      maximumFractionDigits: 2,
    }).format(ticker.close);
  }

  if (ticker.quote) {
    return (
      <div className="ticker-price">
        <i className={`tickerLogo cf cf-${base.toLowerCase()}`}></i>
        <div className="ticker-header-base">{base}</div>
        <div className="ticker-content">
          <div className="ticker-price-value">{priceStr}</div>
          <div className="ticker-price-quote">{quote}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-graph">
      <i className={`tickerLogo cf cf-${base.toLowerCase()}`}></i>
      <div className="ticker-header-base">{base}</div>
      <div className="ticker-content">
        <div className="ticker-loading">Loading...</div>
      </div>
    </div>
  );
};
