import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper";
import { Component } from "react";
import React from "react";

import "./ticker.css";
import "swiper/swiper.min.css";

function Coin({ price, base, quote }) {
  let priceStr;

  try {
    priceStr = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: quote,
      maximumFractionDigits: 2,
    }).format(price);
  } catch (err) {
    priceStr = new Intl.NumberFormat("en-US", {
      style: "decimal",
      maximumFractionDigits: 2,
    }).format(price);
  }

  return (
    <div className="ticker">
      <i id="tickerLogo" className={`cf cf-${base.toLowerCase()}`}></i>
      <div id="tickerPrice">{priceStr}</div>
      <div id="tickerQuote">{`${base}/${quote}`}</div>
    </div>
  );
}

export default class Ticker extends Component {
  render() {
    return (
      <Swiper
        modules={[Autoplay]}
        autoplay={{
          delay: 3000,
        }}
        allowTouchMove={false}
        loop
        enabled={true}
        width={128}
        height={40}
        speed={1900}
      >
        <SwiperSlide>
          <Coin price={20000} quote="USD" base="BTC" />
        </SwiperSlide>
        <SwiperSlide>
          <Coin price={30000} quote="USD" base="BTC" />
        </SwiperSlide>
        <SwiperSlide>
          <Coin price={40000} quote="USD" base="BTC" />
        </SwiperSlide>
        <SwiperSlide>
          <Coin price={50000} quote="USD" base="BTC" />
        </SwiperSlide>
      </Swiper>
    );
  }
}
