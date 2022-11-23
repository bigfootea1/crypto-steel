import get from 'lodash/get';
import maxBy from 'lodash/maxBy';
import minBy from 'lodash/minBy';
import React, { FC, useEffect, useRef } from "react";

import { useCandles } from "./hooks/candles";

import { STEELSERIES_APEX_SCREEN_HEIGHT, STEELSERIES_APEX_SCREEN_WIDTH, ZOOM_FACTOR } from "../../types/constants";
import { CandleUpdate } from "../../types/ticker";
import "./css/ticker-graph.css";

type TickerGraphProps = {
  base: string;
  quote: string;
};

type CanvasProps = {
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const Canvas: FC<CanvasProps> = ({ draw }) => {
  const canvas: any = useRef();
  useEffect(() => {
    if(canvas.current) {
      const context = canvas.current.getContext('2d');
      draw(context);
    }
  });
  return (
    <canvas width={103} height={40} className="ticker-graph-canvas" ref={canvas} />
  );
};


export const TickerGraph: FC<TickerGraphProps> = ({ base, quote }) => {
  const candles = useCandles(base);

  if (quote && candles.length) {
    const LEFT_PADDING = 1;

    const lowCandle = minBy(candles, 'low');
    const highCandle = maxBy(candles, 'high');

    const lowPrice = get(lowCandle, 'low', 0);
    const highPrice = get(highCandle, 'high', 0);

    const calcY = (candle: CandleUpdate) => {
      const ratio = (candle.close - lowPrice) / (highPrice - lowPrice);
      const ypos = STEELSERIES_APEX_SCREEN_HEIGHT - (STEELSERIES_APEX_SCREEN_HEIGHT * ratio);
      return ypos;
    };

    const renderGraph = (ctx: CanvasRenderingContext2D) => {

      // ctx.scale(ZOOM_FACTOR, ZOOM_FACTOR);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'white';
      ctx.fillStyle = 'white';
      ctx.clearRect(0, 0, 103, STEELSERIES_APEX_SCREEN_HEIGHT);
      ctx.beginPath();

      ctx.moveTo(LEFT_PADDING, calcY(candles[0]));

      for(let i = 1; i < candles.length; i++) {
        ctx.lineTo(LEFT_PADDING + ((i / candles.length) * 103), calcY(candles[i]));
      }

      ctx.lineTo(LEFT_PADDING + 103, STEELSERIES_APEX_SCREEN_HEIGHT);
      ctx.lineTo(LEFT_PADDING, STEELSERIES_APEX_SCREEN_HEIGHT);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    return (
      <div className="ticker-graph">
        <i className={`tickerLogo cf cf-${base.toLowerCase()}`}></i>
        <div className="ticker-header-base">{base}</div>
        <div className="ticker-content">
          <Canvas draw={renderGraph}/>
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
