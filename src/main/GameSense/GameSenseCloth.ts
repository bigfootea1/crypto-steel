import EventEmitter from "events";
import log, { handleError } from "../utils";

// const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
// const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
// const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";

export class GameSenseCloth extends EventEmitter {

  constructor(private numZones = 2) {
    super();
    log.info("GameSenseCloth.constructor");
  }

  async resume(): Promise<void> {
    log.info("GameSenseCloth.resume");
    try {
      // await gamesense("bind_game_event", {
      //   json: {
      //     game: GAMESENSE_GAME_NAME,
      //     event: "UPTICK",
      //     value_optional: true,
      //     handlers: [
      //       {
      //         "device-type": "rgb-per-key-zones",
      //         mode: "color",
      //         zone: "all",
      //         color: { red: 0, green: 255, blue: 0 },
      //       },
      //       {
      //         "device-type": "indicator",
      //         mode: "color",
      //         zone: "all",
      //         color: { red: 0, green: 255, blue: 0 },
      //       },
      //     ],
      //   },
      // });

      // await gamesense("bind_game_event", {
      //   json: {
      //     game: GAMESENSE_GAME_NAME,
      //     event: "DNTICK",
      //     value_optional: true,
      //     handlers: [
      //       {
      //         "device-type": "rgb-per-key-zones",
      //         mode: "color",
      //         zone: "all",
      //         color: { red: 255, green: 0, blue: 0 },
      //       },
      //       {
      //         "device-type": "indicator",
      //         mode: "color",
      //         zone: "all",
      //         color: { red: 255, green: 0, blue: 0 },
      //       },
      //     ],
      //   },
      // });

    } catch (err) {
      handleError("GameSenseCloth.resume", err);
    }
  }

  async suspend(): Promise<void> {
    log.info("GameSenseCloth.suspend");
  }

  public triggerEvent = async (event: string): Promise<void> => {
    log.info(`GameSenseCloth.triggerEvent ${event}`);
    // await gamesense
    //   .post("game_event", {
    //     json: {
    //       game: GAMESENSE_GAME_NAME,
    //       event,
    //       data: {},
    //     },
    //   })
    //   .catch((err) => {
    //     handleError("triggerEvent", err);
    //   });
  };

}
