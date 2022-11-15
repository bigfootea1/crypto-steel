import { app, NativeImage, powerMonitor, Rectangle } from 'electron';

import { TickerUpdate } from '../types/ticker';
import App from './App';
import { GameSenseGame, GameSenseKeyboard, GameSenseScreen } from './GameSense';
import Renderer from './Renderer';
import Ticker from './Ticker';
import log, { parsePair } from "./utils";

const ONSCREEN = false;
const DEVTOOLS = false || ONSCREEN;

app.setAppLogsPath();
app.disableHardwareAcceleration();

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  log.debug('App window-all-closed');
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("ready", async () => {

    log.debug('App READY');

    const gamesense = new GameSenseGame();
    const screen = new GameSenseScreen();
    const keyboard = new GameSenseKeyboard();

    const tickerRenderer = new Renderer({
      width: 128,
      height: 40,
      preload: "render/ticker-preload.js",
      url: "render/ticker.html",
      onPaint: (event: any, rect: Rectangle, buff: NativeImage) => {
        screen.update(rect, buff);
      },
      onscreen: ONSCREEN,
      devTools: DEVTOOLS
    });

    const effectRenderer = new Renderer({
      width: 22,
      height: 6,
      preload: "render/effects-preload.js",
      url: "render/effects.html",
      onPaint: (event: any, rect: Rectangle, buff: NativeImage) => {
        keyboard.update(rect, buff);
      },
      onscreen: ONSCREEN,
      devTools: DEVTOOLS,
      positionBelow: tickerRenderer
    });

    const ticker = new Ticker();
    await ticker.loadAssets();

    const theApp = new App(ticker.coinMap);

    const resumeAll = async () => {
      await gamesense.resume();
      await screen.resume();
      await keyboard.resume();
      await effectRenderer.resume();
      await tickerRenderer.resume();
      await ticker.resume();
    };

    const suspendAll = async () => {
      await ticker.suspend();
      await tickerRenderer.suspend();
      await effectRenderer.suspend();
      await keyboard.suspend();
      await screen.suspend();
      await gamesense.suspend();
    };

    theApp.on('quit', async () => {
      log.info('Quitting...');
      await suspendAll();
      app.quit();
    });

    ticker.on("update", (tickerUpdate: TickerUpdate) => {
      tickerRenderer.send(`ticker-update-${tickerUpdate.base}`.toLowerCase(), tickerUpdate);
    });

    ticker.on("status-change", () => ticker.subscribe(theApp.base, theApp.quote));
    theApp.on("config-change", (config) => {
      ticker.subscribe(config.base, config.quote);
    });

    ticker.on("subscribed", (sub: any) => {
      tickerRenderer.send("ticker-subscribe",parsePair(sub.pair));
    });

    ticker.on("unsubscribed", (sub: any) => {
      tickerRenderer.send("ticker-unsubscribe",parsePair(sub.pair));
    });

    powerMonitor.on("suspend", suspendAll);
    powerMonitor.on("resume", resumeAll);

    resumeAll();
});
