import fs from "fs";
import os from "os";
import axios, { AxiosInstance } from "axios";
import EventEmitter from "events";
import _ from "lodash";

const GAMESENSE_CONFIG_LOCATION =
  os.platform() === "win32"
    ? `${process.env.ProgramData}\\SteelSeries\\SteelSeries Engine 3\\coreProps.json`
    : "/Library/Application Support/SteelSeries Engine 3/coreProps.json";

const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";

export default class GameSenseAPI extends EventEmitter {
  private ax: AxiosInstance;
  private heartbeatTimer: NodeJS.Timer;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      const cfg = JSON.parse(
        fs.readFileSync(GAMESENSE_CONFIG_LOCATION).toString()
      );

      this.ax = axios.create({
        baseURL: `http://${cfg.address}`,
        maxContentLength: 1000000,
        maxBodyLength: 1000000,
        maxRedirects: 0,
        headers: { "content-type": "application/json" },
      });

      const ggInfo = await this.ax.post("game_metadata", {
        game: GAMESENSE_GAME_NAME,
        game_display_name: GAMESENSE_GAME_DESCRIPTION,
        developer: GAMESENSE_GAME_DEVELOPER,
      });

      this.heartbeatTimer = setInterval(
        this.heartbeat,
        ggInfo.data.game_metadata.deinitialize_timer_length_ms - 2000
      );
    } catch (err) {
      console.error(err);
    }
  }

  heartbeat = (): void => {
    console.log("Sending heartbeat...");
    this.ax.post("game_heartbeat", {
      game: GAMESENSE_GAME_NAME,
    });
  };

  dispose(): void {
    console.log("dispose");
  }

  async register(): Promise<void> {
    console.log("register");
  }
}
