import { create } from "bitwise/buffer";
import { nativeImage } from "electron";
import EventEmitter from "events";
import { gamesense, hasGameSense } from "./gotGamesense";
import log, { handleError } from "../utils";
import {
  GAMESENSE_GAME_NAME,
  STEELSERIES_APEX_SCREEN_HEIGHT,
  STEELSERIES_APEX_SCREEN_WIDTH,
} from "../../types/constants";

export class GameSenseScreen extends EventEmitter {
  private bitmapBuffer: any[] = [2];
  private bufferIndex = 0;

  constructor(
    private width: number = STEELSERIES_APEX_SCREEN_WIDTH,
    private height: number = STEELSERIES_APEX_SCREEN_HEIGHT
  ) {
    super();
    log.info("GameSenseScreen.constructor");
    this.bitmapBuffer[0] = Buffer.alloc(width * height, 0);
    this.bitmapBuffer[1] = Buffer.alloc(width * height, 0);
  }

  async resume(): Promise<void> {
    if(hasGameSense()) {
      log.info("GameSenseScreen.resume");
      try {
        await gamesense("register_game_event", {
          json: {
            game: GAMESENSE_GAME_NAME,
            event: "SCREENUPDATE",
            value_optional: true,
          },
        });
      } catch (err) {
        handleError("GameSenseScreen.resume", err);
      }
    }
  }

  async suspend(): Promise<void> {
    if(hasGameSense()) {
      log.info("GameSenseScreen.suspend");
      try {
        log.verbose("...clearOLED");
        await this.clear();
      } catch (err) {
        handleError("GameSenseScreen.suspend", err);
      }
    }
  }

  public update = async (
    rect: Electron.Rectangle,
    img: Electron.NativeImage
  ): Promise<void> => {
    if(hasGameSense()) {
      const bmp = img.getBitmap();

      /// Ratserize the bitmap from the browser window instance into the proper 
      /// resolution and color space for the OLED screen
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
          const srcIndex = y * (this.width * 4) + x * 4;
          const destIndex = y * this.width + x;
          const srcVal =
            bmp[srcIndex] + bmp[srcIndex + 1] + bmp[srcIndex + 2] >= 128 * 3;
          this.bitmapBuffer[this.bufferIndex][destIndex] = srcVal ? 1 : 0;
        }
      }

      const dirty = !this.bitmapBuffer[0].equals(this.bitmapBuffer[1]);
      this.bufferIndex = (this.bufferIndex === 0) ? 1 : 0;

      if(dirty) {
        /// Transmit the image data to the gamesense SDK
        const evt = {
          game: GAMESENSE_GAME_NAME,
          event: "SCREENUPDATE",
          data: {
            frame: {
              "image-data-128x40": [...create(this.bitmapBuffer[this.bufferIndex])],
            },
          },
        };
    
        await gamesense("game_event", { json: evt }).catch((err) => {
          handleError("updateOLED", err);
        });
      }
    }
  };

  public clear = async (): Promise<void> => {
    await this.update(
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
