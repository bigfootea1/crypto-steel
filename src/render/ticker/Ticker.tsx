import React, { VFC } from "react";
import { Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";

import { useTickerSubscriptions } from "./hooks/tickerSubscriptions";

import "swiper/swiper.min.css";
import "./css/ticker.css";

import { TickerGraph } from "./TickerGraph";
import { TickerPrice } from "./TickerPrice";
import { STEELSERIES_APEX_SCREEN_WIDTH, STEELSERIES_APEX_SCREEN_HEIGHT } from "../../types/constants";

export const Ticker: VFC = () => {
  const subs = useTickerSubscriptions();

  const slides = [];

  subs.forEach(({ base, quote }) => {
    slides.push(
      <SwiperSlide key={`${base}/${quote}-graph`}>
        <TickerGraph quote={quote} base={base} />
      </SwiperSlide>
    );
    slides.push(
      <SwiperSlide key={`${base}/${quote}-price`}>
        <TickerPrice quote={quote} base={base} />
      </SwiperSlide>
    );
  });

  return (
    <div className='ticker'>
      <Swiper
        modules={[Autoplay]}
        autoplay={{
          delay: 4000,
        }}
        allowTouchMove={false}
        longSwipes={false}
        preventInteractionOnTransition={true}
        resistance={false}
        roundLengths={true}
        slidesPerView={1}
        updateOnWindowResize={false}
        loop
        direction="horizontal"
        enabled={true}
        width={STEELSERIES_APEX_SCREEN_WIDTH}
        height={STEELSERIES_APEX_SCREEN_HEIGHT}
        speed={1900}
      >
        {slides}
      </Swiper>
    </div>
  );
};
