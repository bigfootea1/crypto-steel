import { app, powerMonitor } from 'electron';
import App from './App';
import Ticker from './Ticker';
import log from "./utils";

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

    const ticker = new Ticker();
    await ticker.loadAssets();

    const theApp = new App(ticker.coinMap);

    theApp.on('quit', async () => {
      await ticker.suspend();
      app.quit();
    });

    ticker.on("config", (cfg) => {
      log.info('config: ', cfg);
    });

    // ticker.on("update", (cfg) => {
    //   log.info('update: ', cfg);
    // });

    ticker.on("status-change", (event: any) => {
      if(event.status === 'online') {
        ticker.subscribe(theApp.base, theApp.quote);
      }
    });

    theApp.on("config-change", (config) => {
      ticker.subscribe(config.base, config.quote);
    });

    powerMonitor.on("suspend", async () => {
      log.info('CryptoSteel.suspend');
      await ticker.suspend();
    });
    
    powerMonitor.on("resume", async () => {
      log.info('CryptoSteel.resume');
      await ticker.resume();
    });

    await ticker.resume();
});

