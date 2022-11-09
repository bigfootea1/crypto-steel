import { create } from "bitwise/buffer";
import { nativeImage } from "electron";
import EventEmitter from "events";
import gamesense from "./gotGamesense";
import log, { handleError } from "./utils";

const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";

export default class GameSense extends EventEmitter {
  private heartbeatTimer: NodeJS.Timer;
  private bitmapBuffer: any;

  constructor(private width: number = 128, private height: number = 40) {
    super();
    log.info("GameSense.constructor");
    this.bitmapBuffer = Buffer.alloc(width * height, 0);
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
        () =>
          gamesense("game_heartbeat", {
            json: {
              game: GAMESENSE_GAME_NAME,
            },
          }),
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

  public updateOLED = async (
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

  public clearOLED = async (): Promise<void> => {
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
