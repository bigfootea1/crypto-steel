import EventEmitter from "events";
import gamesense from "./gotGamesense";
import log, { handleError } from "../utils";

export const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";

export class GameSenseGame extends EventEmitter {
  private heartbeatTimer: NodeJS.Timer;

  constructor() {
    super();
    log.info("GameSenseGame.constructor");
  }

  async resume(): Promise<void> {
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

  async suspend(): Promise<void> {
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
