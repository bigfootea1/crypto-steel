import EventEmitter from "events";
import { gamesense, hasGameSense } from "./gotGamesense";
import log, { handleError } from "../utils";
import {
  GAMESENSE_GAME_NAME,
  GAMESENSE_GAME_DESCRIPTION,
  GAMESENSE_GAME_DEVELOPER,
} from "../../types/constants";

export class GameSenseGame extends EventEmitter {
  private heartbeatTimer: NodeJS.Timer;

  constructor() {
    super();
    log.info("GameSenseGame.constructor");
  }

  async resume(): Promise<void> {
    if (hasGameSense()) {
      log.info("GameSenseGame.resume");
      try {
        const ggInfo: any = await gamesense("game_metadata", {
          json: {
            game: GAMESENSE_GAME_NAME,
            game_display_name: GAMESENSE_GAME_DESCRIPTION,
            developer: GAMESENSE_GAME_DEVELOPER,
          },
        }).json();

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
        handleError("GameSenseGame.resume", err);
      }
    }
  }

  async suspend(): Promise<void> {
    if (hasGameSense()) {
      log.info("GameSenseGame.suspend");
      try {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }

        log.verbose("...remove_game");
        await gamesense("remove_game", {
          json: {
            game: GAMESENSE_GAME_NAME,
          },
        });
      } catch (err) {
        handleError("GameSenseGame.suspend", err);
      }
    }
  }
}
