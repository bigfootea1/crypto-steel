import React, { FC, useReducer, VFC } from "react";
import { Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import map from 'lodash/map';

import { TickerPair } from "../types/ticker";
import { useTicker } from "./hooks/ticker";
import { useTickerSubscriptions } from "./hooks/tickerSubscriptions";

import "swiper/swiper.min.css";
import "./css/ticker.css";

const Coin: FC<TickerPair> = (tickerpair: TickerPair) => {
  const [pair] = useReducer((thePair: TickerPair) => thePair, tickerpair);
  const ticker = useTicker(pair.base);

  let priceStr: string;
  try {
    priceStr = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: pair.quote,
      maximumFractionDigits: 2,
    }).format(ticker.close);
  } catch (err) {
    priceStr = new Intl.NumberFormat("en-US", {
      style: "decimal",
      maximumFractionDigits: 2,
    }).format(ticker.close);
  }

  return (
    <div className="ticker">
      <i id="tickerLogo" className={`cf cf-${pair.base.toLowerCase()}`}></i>
      <div id="tickerPrice"><span>{priceStr}</span></div>
      <div id="tickerQuote">{`${pair.base}/${pair.quote}`}</div>
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

  console.log('slide count: ', slides.length);

  return (
    <Swiper
      modules={[Autoplay]}
      autoplay={{
        delay: 3000,
      }}
      allowTouchMove={false}
      loop
      direction="vertical"
      // enabled={true}
      width={128}
      height={40}
      speed={1900}
      onSlidesLengthChange={(swiper) => {
        if(slides.length === 1) {
          swiper.autoplay.stop();
        } else {
          swiper.autoplay.start();
        }
      }}
      // onSlideChange={() => window.ticker.sendState("state here")}
    >
      {slides}
    </Swiper>
  );
};
