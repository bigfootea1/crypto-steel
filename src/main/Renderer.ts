import { BrowserWindow, NativeImage } from "electron";
import EventEmitter from "events";
import path from "path";
import log from "./utils";

const DEBUG_OFFSCREEN_BROWSER = true;
const DEVTOOLS_ENABLED = false || DEBUG_OFFSCREEN_BROWSER;

const ZOOM_FACTOR = DEBUG_OFFSCREEN_BROWSER ? 4 : 1;

export default class Renderer extends EventEmitter {
  private bitmapBuffer: any;
  private renderWindow: BrowserWindow;

  constructor(private width: number = 128, private height: number = 40) {
    super();
    log.info("Renderer.constructor");
    this.bitmapBuffer = Buffer.alloc(width * height, 0);

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
        // zoomFactor: 1.0,
        preload: path.join(
          __dirname,
          "..",
          "..",
          "app",
          "preload",
          "preload.js"
        ),
      },
    });

    this.renderWindow.once("ready-to-show", () => {
      this.renderWindow.webContents.setZoomFactor(ZOOM_FACTOR);
      // this.renderWindow.webContents.setFrameRate(60);
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

    this.renderWindow.loadFile(rendererPage);

    if (DEBUG_OFFSCREEN_BROWSER || DEVTOOLS_ENABLED) {
      this.renderWindow.webContents.openDevTools();
    }
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

    this.emit('render', rect, this.bitmapBuffer);

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
 
}
