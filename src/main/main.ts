import { app, NativeImage, powerMonitor, Rectangle } from "electron";

import { CandleUpdate, TickerUpdate } from "../types/ticker";
import App from "./App";
import { GameSenseGame, GameSenseKeyboard, GameSenseScreen, hasGameSense, initGameSense } from "./GameSense";
import Renderer from "./Renderer";
import Ticker, { Subscription } from "./Ticker";
import log, { parsePair } from "./utils";

import difference from "lodash/difference";
import drop from "lodash/drop";
import first from "lodash/first";
import flatten from "lodash/flatten";
import forEach from "lodash/forEach";
import last from "lodash/last";
import map from "lodash/map";
import omit from "lodash/omit";
import sortBy from "lodash/sortBy";
import values from "lodash/values";
import {
  CANDLE_INTERVAL_MINUTES,
  CANDLE_RANGE_MINUTES,
  DEVTOOLS,
  ONSCREEN,
  STEELSERIES_APEX_SCREEN_HEIGHT,
  STEELSERIES_APEX_SCREEN_WIDTH,
} from "../types/constants";
import kracken from "./gotKracken";

app.setAppLogsPath();
app.disableHardwareAcceleration();

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  log.debug("App window-all-closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("ready", async () => {
  let candleData: CandleUpdate[] = [];

  /// Validate that the GameSense driver is loaded and working
  await initGameSense();

  const gamesensegame = new GameSenseGame();
  const screen = new GameSenseScreen();
  const keyboard = new GameSenseKeyboard();

  // Create a renderer for the ticker screen
  const tickerRenderer = new Renderer({
    width: STEELSERIES_APEX_SCREEN_WIDTH,
    height: STEELSERIES_APEX_SCREEN_HEIGHT,
    preload: "render/ticker-preload.js",
    url: "render/ticker.html",
    onPaint: (event: any, rect: Rectangle, buff: NativeImage) => {
      screen.update(rect, buff);
    },
    onscreen: ONSCREEN || !hasGameSense(),
    devTools: DEVTOOLS,
  });

  // Create a renderer for the keyboard lighting effects
  const effectRenderer = new Renderer({
    width: 22,
    height: 6,
    preload: "render/effects-preload.js",
    url: "render/effects.html",
    onPaint: (event: any, rect: Rectangle, buff: NativeImage) => {
      keyboard.update(rect, buff);
    },
    onscreen: ONSCREEN || !hasGameSense(),
    devTools: DEVTOOLS,
    positionBelow: tickerRenderer,
  });

  // TODO: create renderer for the PRISM cloth.

  const ticker = new Ticker();

  // Load the configuration and assets from Kracken
  await ticker.loadAssets();

  const theApp = new App(ticker.coinMap);

  /// Resume all services when machine is awakened
  const resumeAll = async () => {
    await gamesensegame.resume();
    await screen.resume();
    await keyboard.resume();
    await effectRenderer.resume();
    await tickerRenderer.resume();
    await ticker.resume();
  };

  /// Resume all services when machine goes to sleep
  const suspendAll = async () => {
    await ticker.suspend();
    await tickerRenderer.suspend();
    await effectRenderer.suspend();
    await keyboard.suspend();
    await screen.suspend();
    await gamesensegame.suspend();
  };

  // Subscribe to the ticker and candle updates for a particular pair
  const subscribePair = async (pair: string) => {
    ticker.subscribe(pair, 1);
    ticker.subscribe(pair, CANDLE_INTERVAL_MINUTES);
  };

  const unsubscribePair = async (pair: string) => {
    ticker.unsubscribe(pair, 1);
    ticker.unsubscribe(pair, CANDLE_INTERVAL_MINUTES);
  };

  /// Retrieves the historical candle data from the Kracken REST api.
  const getCandles = async (candlePair: string): Promise<any[]> => {
    const pair = candlePair.replace("/", "");

    const serverTime = await kracken("Time")
      .json<any[]>()
      .then((response: any) => response.result.unixtime)
      .catch((): any => undefined);

    const since = serverTime - CANDLE_RANGE_MINUTES * 60;

    const candles = await kracken("OHLC", {
      searchParams: {
        pair,
        interval: CANDLE_INTERVAL_MINUTES,
        since,
      },
    })
      .json<any[]>()
      .then((resp: any) => flatten(values(omit(resp.result, "last"))))
      .catch((): any[] => []);

    const result: CandleUpdate[] = map(candles, (c: any[]) => ({
      endtime: c[0],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      vwap: parseFloat(c[5]),
      volume: parseFloat(c[6]),
    }));

    return sortBy(result, "endtime");
  };

  /// When we're quitting, make sure we close everything properly
  theApp.on("quit", async () => {
    log.info("Quitting...");
    await suspendAll();
    app.quit();
  });

  /// When the WebSocket delivers a ticker update, we process it here and send it
  /// down to the ticker renderer
  ticker.on("update", (tickerUpdate: TickerUpdate) => {
    if (
      candleData.length &&
      tickerUpdate.interval === CANDLE_INTERVAL_MINUTES
    ) {
      const firstUpdate = first(candleData);
      const lastUpdate = last(candleData);

      if (tickerUpdate.endtime > lastUpdate.endtime) {
        candleData.push({
          endtime: tickerUpdate.endtime,
          open: tickerUpdate.open,
          high: tickerUpdate.high,
          low: tickerUpdate.low,
          close: tickerUpdate.close,
          vwap: tickerUpdate.vwap,
          volume: tickerUpdate.volume,
        });

        if (
          (tickerUpdate.endtime - firstUpdate.endtime) / 60 >=
          CANDLE_RANGE_MINUTES
        ) {
          candleData = drop(candleData);
        }
        log.info('Sending candles for ', `candle-update-${tickerUpdate.base}`.toLowerCase());
        tickerRenderer.send(
          `candle-update-${tickerUpdate.base}`.toLowerCase(),
          candleData
        );
      }
    } else {
      tickerRenderer.send(
        `ticker-update-${tickerUpdate.base}`.toLowerCase(),
        tickerUpdate
      );
    }
  });

  /// The status-change message is received upon connection to the Kracken WebSocket.
  /// It is also sent whenever the server goes into "maintenance mode", etc
  /// TODO:  Properly handle server status changes while running
  ticker.on("status-change", () => {
    forEach(theApp.base, (base) => {
      subscribePair(`${base}/${theApp.quote}`);
    });
  });

  /// The main app will fire a config-change event when the user changes the base/quote settings.
  /// TODO: Add more settings, allow time/delay settings, etc.
  theApp.on("config-change", (fromConfig, config) => {
    // log.info(`config-change: ${JSON.stringify(fromConfig, null, 2)} - ${JSON.stringify(config, null, 2)}`);
    const baseRemoved: string[] = difference<string>(
      fromConfig.base,
      config.base
    );
    const baseAdded: string[] = difference<string>(
      config.base,
      fromConfig.base
    );

    forEach(baseRemoved, (unsub) => {
      unsubscribePair(`${unsub}/${config.quote}`);
    });
    forEach(baseAdded, (sub) => {
      subscribePair(`${sub}/${config.quote}`);
    });
  });

  /// Received when a ticker pair has been successfully subscribed to the WebSocket
  ticker.on("subscribed", async (sub: Subscription) => {
    const pair = parsePair(sub.pair);
    if (sub.subscription.interval === CANDLE_INTERVAL_MINUTES) {
      candleData = await getCandles(sub.pair);
      tickerRenderer.send(
        `candle-update-${pair.base}`.toLowerCase(),
        candleData
      );
    } else {
      tickerRenderer.send("ticker-subscribe", {
        quote: pair.quote,
        base: pair.base,
        interval: sub.subscription.interval,
      });
    }
  });

  ticker.on("unsubscribed", (sub: Subscription) => {
    if (sub.subscription.interval !== CANDLE_INTERVAL_MINUTES) {
      tickerRenderer.send("ticker-unsubscribe", parsePair(sub.pair));
    }
  });

  powerMonitor.on("suspend", suspendAll);
  powerMonitor.on("resume", resumeAll);

  /// Upon initial startup, it's exactly the same as resuming from sleep,
  /// thus is why we call resumeAll() to start everything up.
  resumeAll();
});
