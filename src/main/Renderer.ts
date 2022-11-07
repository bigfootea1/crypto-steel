import { create } from "bitwise/buffer";
import { BrowserWindow, ipcMain, NativeImage } from "electron";
import EventEmitter from "events";
import path from "path";
import { TickerPair, TickerUpdate } from "../types/ticker";
import log from "./utils";

const DEBUG_OFFSCREEN_BROWSER = true;
const DEVTOOLS_ENABLED = true || DEBUG_OFFSCREEN_BROWSER;

const ZOOM_FACTOR = DEBUG_OFFSCREEN_BROWSER ? 4 : 1;

export default class Renderer extends EventEmitter {
  private bitmapBuffer: any;
  private renderWindow: BrowserWindow;

  public bitBuffer: Buffer;

  constructor(private width: number = 128, private height: number = 40) {
    super();
    log.info("Renderer.constructor");
    this.bitmapBuffer = Buffer.alloc(width * height, 0);

    ipcMain.on('render-state-change', (event: any, state: any) => {
      // log.info('render state change: ', state);
    });
  }

  private updateOLED = async (
    rect: Electron.Rectangle,
    img: Electron.NativeImage
  ): Promise<void> => {
    const bmp = img.getBitmap();

    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const srcIndex = y * (this.width * 4) + x * 4;
        const destIndex = y * this.width + x;
        const srcVal =
          bmp[srcIndex] + bmp[srcIndex + 1] + bmp[srcIndex + 2] >= 128 * 3;
        this.bitmapBuffer[destIndex] = srcVal ? 1 : 0;
      }
    }

    this.bitBuffer = create(this.bitmapBuffer);
    this.emit("render", rect, this.bitBuffer);

    // const evt = {
    //   game: GAMESENSE_GAME_NAME,
    //   event: "SCREENUPDATE",
    //   data: {
    //     frame: {
    //       "image-data-128x40": [...create(this.bitmapBuffer)],
    //     },
    //   },
    // };

    // await gamesense("game_event", { json: evt }).catch((err) => {
    //   handleError("updateOLED", err);
    // });
  };

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
            "preload.js"
          ),
        },
      });

      this.renderWindow.once("ready-to-show", () => {
        this.renderWindow.webContents.setZoomFactor(ZOOM_FACTOR);
        this.renderWindow.webContents.setFrameRate(5);
        if (DEBUG_OFFSCREEN_BROWSER) {
          this.renderWindow.show();
        }
      });

      this.renderWindow.webContents.on(
        "paint",
        (event, dirty, image: NativeImage) => {
          this.updateOLED(dirty, image);
        }
      );

      const rendererPage = path.join(
        __dirname,
        "..",
        "..",
        "app",
        "render",
        "index.html"
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
