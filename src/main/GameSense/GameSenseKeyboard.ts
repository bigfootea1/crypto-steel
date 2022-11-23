import EventEmitter from "events";
import { GAMESENSE_GAME_NAME } from "../../types/constants";
import log, { handleError } from "../utils";
import { gamesense, hasGameSense } from "./gotGamesense";

export class GameSenseKeyboard extends EventEmitter {
  private ledMatrix: number[][];

  constructor(private width: number = 22, private height: number = 6) {
    super();
    if(hasGameSense()) {
      log.info("GameSenseKeyboard.constructor");
      this.ledMatrix = new Array(width * height).fill([0, 0, 0]);
    }
  }

  async resume(): Promise<void> {
    if(hasGameSense()) {
      log.info("GameSenseKeyboard.resume");
      try {
        await gamesense("register_game_event", {
          json: {
            game: GAMESENSE_GAME_NAME,
            event: "KEYBOARDUPDATE",
            value_optional: true,
            handlers: [
              {
                "device-type": "rgb-per-key-zones",
                mode: "bitmap",
              },
            ],
          },
        });
      } catch (err) {
        handleError("GameSenseKeyboard.resume", err);
      }
    }
  }

  async suspend(): Promise<void> {
    if(hasGameSense()) {
      log.info("GameSenseKeyboard.suspend");
      try {
        log.verbose("...clear keyboard LEDs");
        await this.clear();
      } catch (err) {
        handleError("GameSenseKeyboard.suspend", err);
      }
    }
  }

  public update = async (
    rect: Electron.Rectangle,
    rawimg: Electron.NativeImage
  ): Promise<void> => {

    if(hasGameSense()) {
      const { width } = rawimg.getSize();
      const bmp = rawimg.getBitmap();
  
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const srcIndex = y * (width * 4) + x * 4;
          const dstIndex = y * this.width + x;
          this.ledMatrix[dstIndex] = [
            bmp[srcIndex + 2],
            bmp[srcIndex + 1],
            bmp[srcIndex],
          ];
        }
      }
  
      // console.log('------------------------------------------------------------------------------------------');
      // for (let y = 0; y < this.height; y++) {
      //   let lineStr = '';
      //   for (let x = 0; x < this.width; x++) {
      //     const srcIndex = y * this.width + x;
      //     lineStr = lineStr.concat(`${this.ledMatrix[srcIndex][0]}|${this.ledMatrix[srcIndex][1]}|${this.ledMatrix[srcIndex][2]}|`);
      //   }
      //   console.log(`${y}:${lineStr}`);
      // }
  
      const evt = {
        game: GAMESENSE_GAME_NAME,
        event: "KEYBOARDUPDATE",
        data: {
          frame: {
            bitmap: this.ledMatrix,
          },
        },
      };
  
      await gamesense("game_event", { json: evt }).catch((err) => {
        handleError("update keyboard", err);
      });
    }
  };

  public clear = async (): Promise<void> => {
    if(hasGameSense()) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const dstIndex = y * this.width + x;
          this.ledMatrix[dstIndex] = [0, 0, 0];
        }
      }
  
      const evt = {
        game: GAMESENSE_GAME_NAME,
        event: "KEYBOARDUPDATE",
        data: {
          frame: {
            bitmap: this.ledMatrix,
          },
        },
      };
  
      await gamesense("game_event", { json: evt }).catch((err) => {
        handleError("update keyboard", err);
      });
   }
  };
}
