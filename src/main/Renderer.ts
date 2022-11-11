import { BrowserWindow, NativeImage } from "electron";
import EventEmitter from "events";
import path from "path";
import { TickerPair, TickerUpdate } from "../types/ticker";
import log from "./utils";

const DEBUG_OFFSCREEN_BROWSER = true;
const DEVTOOLS_ENABLED = true || DEBUG_OFFSCREEN_BROWSER;

const ZOOM_FACTOR = DEBUG_OFFSCREEN_BROWSER ? 4 : 1;

export default class Renderer extends EventEmitter {
  private renderWindow: BrowserWindow;

  public bitBuffer: Buffer;

  constructor(private width: number = 128, private height: number = 40) {
    super();
    log.info("Renderer.constructor");
  }

  public suspend = async (): Promise<void> => {
    if (this.renderWindow) {
      log.info('Renderer.suspend');
      this.renderWindow.close();
      this.renderWindow = null;
    }
  };

  public resume = async (): Promise<void> => {
    if (!this.renderWindow) {
      log.info('Renderer.resume');

      // Create the browser window.
      this.renderWindow = new BrowserWindow({
        useContentSize: true,
        width: this.width * ZOOM_FACTOR,
        height: this.height * ZOOM_FACTOR,
        minimizable: false,
        maximizable: false,
        transparent: false,
        fullscreenable: false,
        alwaysOnTop: DEBUG_OFFSCREEN_BROWSER,
        show: false,
        frame: false,
        resizable: DEBUG_OFFSCREEN_BROWSER,
        backgroundColor: "black",
        webPreferences: {
          offscreen: !DEBUG_OFFSCREEN_BROWSER,
          textAreasAreResizable: false,
          nodeIntegration: true,
          contextIsolation: true,
          preload: path.join(
            __dirname,
            "..",
            "..",
            "app",
            "render",
            "ticker-preload.js"
          ),
        },
      });

      this.renderWindow.once("ready-to-show", () => {
        this.renderWindow.webContents.setZoomFactor(ZOOM_FACTOR);
        this.renderWindow.webContents.setFrameRate(20);
        if (DEBUG_OFFSCREEN_BROWSER) {
          this.renderWindow.show();
        }
      });

      this.renderWindow.webContents.on(
        "paint",
        (event, dirty, image: NativeImage) => {
          this.emit("render", dirty, image);
        }
      );

      const rendererPage = path.join(
        __dirname,
        "..",
        "..",
        "app",
        "render",
        "ticker.html"
      );

      await this.renderWindow.loadFile(rendererPage);

      if (DEBUG_OFFSCREEN_BROWSER || DEVTOOLS_ENABLED) {
        this.renderWindow.webContents.openDevTools();
      }
    }
  };

  public tickerUpdate(data: TickerUpdate): void {
    const channelName = `ticker-update-${data.base}`.toLowerCase();
    this.renderWindow.webContents.send(channelName, data);
  }

  public tickerSubscribe(pair: TickerPair): void {
    this.renderWindow.webContents.send("ticker-subscribe", pair);
  }

  public tickerUnsubscribe(pair: TickerPair): void {
    this.renderWindow.webContents.send("ticker-unsubscribe", pair);
  }

}
