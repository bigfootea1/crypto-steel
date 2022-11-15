import { create } from "bitwise/buffer";
import { nativeImage } from "electron";
import EventEmitter from "events";
import gamesense from "./gotGamesense";
import log, { handleError } from "../utils";

import { GAMESENSE_GAME_NAME } from './GameSenseGame';

export class GameSenseScreen extends EventEmitter {
  private bitmapBuffer: any;

  constructor(private width: number = 128, private height: number = 40) {
    super();
    log.info("GameSenseScreen.constructor");
    this.bitmapBuffer = Buffer.alloc(width * height, 0);
  }

  async resume(): Promise<void> {
    log.info("GameSenseScreen.resume");
    try {

      await gamesense("register_game_event", {
        json: {
          game: GAMESENSE_GAME_NAME,
          event: "SCREENUPDATE",
          value_optional: true
        },
      });

    } catch (err) {
      handleError("GameSenseScreen.resume", err);
    }
  }

  async suspend(): Promise<void> {
    log.info("GameSenseScreen.suspend");
    try {
      log.verbose("...clearOLED");
      await this.clear();
    } catch (err) {
      handleError("GameSenseScreen.suspend", err);
    }
  }

  public update = async (
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
