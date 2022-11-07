import { app, powerMonitor } from 'electron';
import { TickerUpdate } from '../types/ticker';
import App from './App';
import Renderer from './Renderer';
import Ticker from './Ticker';
import log, { parsePair } from "./utils";

app.setAppLogsPath();

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

    const renderer = new Renderer();

    renderer.on('render', (rect: any, buff: any) => {
      // log.info(rect);
    });

    const ticker = new Ticker();
    await ticker.loadAssets();

    const theApp = new App(ticker.coinMap);

    theApp.on('quit', async () => {
      await ticker.suspend();
      await renderer.suspend();
      app.quit();
    });

    ticker.on("config", (cfg) => {
      log.info('config: ', cfg);
    });

    ticker.on("update", (tickerUpdate: TickerUpdate) => {
      renderer.tickerUpdate(tickerUpdate);
    });

    ticker.on("status-change", () => ticker.subscribe(theApp.base, theApp.quote));
    theApp.on("config-change", (config) => {
      ticker.subscribe(config.base, config.quote);
    });

    ticker.on("subscribed", (sub: any) => {
      renderer.tickerSubscribe(parsePair(sub.pair));
    });

    ticker.on("unsubscribed", (sub: any) => {
      renderer.tickerUnsubscribe(parsePair(sub.pair));
    });

    powerMonitor.on("suspend", async () => {
      log.info('CryptoSteel.suspend');
      await ticker.suspend();
      await renderer.suspend();
    });
    
    powerMonitor.on("resume", async () => {
      log.info('CryptoSteel.resume');
      await renderer.resume();
      await ticker.resume();
    });

    await renderer.resume();
    await ticker.resume();
});
