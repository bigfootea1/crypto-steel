import path from 'path';
import EventEmitter from "events";
import gamesense from "./gotGamesense";
import { create } from "bitwise/buffer";
import { nativeImage, BrowserWindow, NativeImage } from "electron";
import log, { handleError } from "./utils";
import { TickerUpdate } from "./Ticker";

const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";

const DEBUG_OFFSCREEN_BROWSER = false;
const DEVTOOLS_ENABLED = false || DEBUG_OFFSCREEN_BROWSER;

export default class GameSense extends EventEmitter {
  private heartbeatTimer: NodeJS.Timer;

  private bitmapBuffer: any;

  private renderWindow: BrowserWindow;
  private lastUpdateTime = 0;

  constructor(private width: number = 128, private height: number = 40) {
    super();
    log.info("GameSense.constructor");
    this.bitmapBuffer = Buffer.alloc(width * height, 0);

    this.createRenderWindow();
  }

  async resume(): Promise<void> {
    log.info("GameSense.resume");
    try {

      const ggInfo: any = await gamesense("game_metadata", {
        json: {
          game: GAMESENSE_GAME_NAME,
          game_display_name: GAMESENSE_GAME_DESCRIPTION,
          developer: GAMESENSE_GAME_DEVELOPER,
        },
      }).json();

      await gamesense("bind_game_event", {
        json: {
          game: GAMESENSE_GAME_NAME,
          event: "SCREENUPDATE",
          value_optional: true,
          handlers: [
            {
              "device-type": "screened-128x40",
              mode: "screen",
              zone: "one",
              value_optional: true,
              datas: [
                {
                  "has-text": false,
                  "image-data": [...create(this.bitmapBuffer)],
                },
              ],
            },
          ],
        },
      });

      await gamesense("bind_game_event", {
        json: {
          game: GAMESENSE_GAME_NAME,
          event: "UPTICK",
          value_optional: true,
          handlers: [
            {
              "device-type": "rgb-per-key-zones",
              mode: "color",
              zone: "all",
              color: { red: 0, green: 255, blue: 0 },
            },
            {
              "device-type": "indicator",
              mode: "color",
              zone: "all",
              color: { red: 0, green: 255, blue: 0 },
            },
          ],
        },
      });

      await gamesense("bind_game_event", {
        json: {
          game: GAMESENSE_GAME_NAME,
          event: "DNTICK",
          value_optional: true,
          handlers: [
            {
              "device-type": "rgb-per-key-zones",
              mode: "color",
              zone: "all",
              color: { red: 255, green: 0, blue: 0 },
            },
            {
              "device-type": "indicator",
              mode: "color",
              zone: "all",
              color: { red: 255, green: 0, blue: 0 },
            },
          ],
        },
      });

      this.heartbeatTimer = setInterval(
        this.heartbeat,
        ggInfo.game_metadata.deinitialize_timer_length_ms - 2000
      );
    } catch (err) {
      handleError("GameSense.resume", err);
    }
  }

  async suspend(): Promise<void> {
    log.info("GameSense.suspend");
    try {

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      log.verbose("...clearOLED");
      await this.clearOLED();

      log.verbose("...remove_game");
      await gamesense("remove_game", {
        json: {
          game: GAMESENSE_GAME_NAME,
        },
      });
    } catch (err) {
      handleError("GameSense.suspend", err);
    }
  }

  public triggerEvent = async (event: string): Promise<void> => {
    log.info(`GameSense.triggerEvent ${event}`);
    await gamesense
      .post("game_event", {
        json: {
          game: GAMESENSE_GAME_NAME,
          event,
          data: {},
        },
      })
      .catch((err) => {
        handleError("triggerEvent", err);
      });
  };

  private createRenderWindow() {
    log.verbose('CryptoSteel.createRenderWindow');
    // Create the browser window.
    this.renderWindow = new BrowserWindow({
      width: 128,
      height: 40,
      minWidth: 128,
      minHeight: 40,
      minimizable: false,
      maximizable: false,
      transparent: true,
      alwaysOnTop: DEBUG_OFFSCREEN_BROWSER,
      show: DEBUG_OFFSCREEN_BROWSER,
      frame: false,
      resizable: true,
      webPreferences: {
        offscreen: !DEBUG_OFFSCREEN_BROWSER, 
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js') 
      } 
    });

    this.renderWindow.webContents.on("paint", (event, dirty, image: NativeImage) => {
      this.updateOLED(dirty, image);
    });

    this.renderWindow.webContents.setFrameRate(10);

    if(DEBUG_OFFSCREEN_BROWSER || DEVTOOLS_ENABLED) {
      this.renderWindow.webContents.openDevTools();
    }

    this.renderWindow.loadFile(path.join(__dirname, "../static/html/index.html"));
  }

  onTickerUpdate = (data: TickerUpdate): void => {
    if(this.renderWindow) {
      this.renderWindow.webContents.send('tickerupdate', data);
    }

    if((Date.now() - this.lastUpdateTime) > (60000)) {
      if(data.delta > 0) {
        this.triggerEvent('UPTICK');
      }
      if(data.delta < 0) {
        this.triggerEvent('DNTICK');
      }
      this.lastUpdateTime = Date.now();
    }
  };

  onHeartbeat = (): void => {
    if(this.renderWindow) {
      this.renderWindow.webContents.send('heartbeat');
    }
  };

  private heartbeat = (): void => {
    gamesense("game_heartbeat", {
      json: {
        game: GAMESENSE_GAME_NAME,
      },
    });
  };

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

    const evt = {
      game: GAMESENSE_GAME_NAME,
      event: "SCREENUPDATE",
      data: {
        frame: {
          "image-data-128x40": [...create(this.bitmapBuffer)],
        },
      },
    };

    await gamesense("game_event", { json: evt }).catch((err) => {
      handleError("updateOLED", err);
    });
  };

  private clearOLED = async (): Promise<void> => {
    await this.updateOLED(
      {
        height: this.height,
        width: this.width,
        x: 0,
        y: 0,
      } as Electron.Rectangle,
      nativeImage.createEmpty()
    );
  };

}
