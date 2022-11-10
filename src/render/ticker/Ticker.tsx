import map from "lodash/map";
import React, { FC, VFC } from "react";
import { Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";

import { useTicker } from "./hooks/ticker";
import { useTickerSubscriptions } from "./hooks/tickerSubscriptions";

import "swiper/swiper.min.css";
import "./css/ticker.css";

interface CoinProps {
  base: string;
  quote: string;
}

const Coin: FC<CoinProps> = ({ base, quote }) => {
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
      <div className="ticker">
        <i id="tickerLogo" className={`cf cf-${base.toLowerCase()}`}></i>
        <div id="tickerPrice">{priceStr}</div>
        <div id="tickerQuote">{`${base} / ${quote}`}</div>
      </div>
    );
  }

  return (
    <div className="ticker">
        <i id="tickerLogo" className={`cf cf-${base.toLowerCase()}`}></i>
      <div id="tickerLoading">Loading...</div>
    </div>
  );
};

export const Ticker: VFC = () => {
  const subs = useTickerSubscriptions();

  const slides = map(subs, ({ quote, base }) => (
    <SwiperSlide key={`${base}/${quote}`}>
      <Coin quote={quote} base={base} />
    </SwiperSlide>
  ));

  return (
    <Swiper
      modules={[Autoplay]}
      autoplay={{
        delay: 10000,
      }}
      allowTouchMove={false}
      longSwipes={false}
      preventInteractionOnTransition={true}
      resistance={false}
      roundLengths={true}
      slidesPerView={1}
      updateOnWindowResize={false}
      loop
      direction="vertical"
      enabled={true}
      width={128}
      height={40}
      speed={1900}
      onSlidesLengthChange={(swiper) => {
        if (slides.length === 1) {
          swiper.autoplay.stop();
        } else {
          swiper.autoplay.start();
        }
      }}
    >
      {slides}
    </Swiper>
  );
};
