import fs from "fs";
import os from "os";
import axios, { AxiosInstance } from "axios";
import EventEmitter from "events";
// import _ from "lodash";
import { create } from 'bitwise/buffer';
import { nativeImage } from "electron";

const GAMESENSE_CONFIG_LOCATION =
  os.platform() === "win32"
    ? `${process.env.ProgramData}\\SteelSeries\\SteelSeries Engine 3\\coreProps.json`
    : "/Library/Application Support/SteelSeries Engine 3/coreProps.json";

const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";

export default class GameSense extends EventEmitter {
  private ax: AxiosInstance;
  private heartbeatTimer: NodeJS.Timer;
  
  private bitmapBuffer: any;
  
  constructor(private width: number = 128, private height: number = 40) {
    super();
    this.bitmapBuffer = Buffer.alloc(width * height, 0);
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

      const ggInfo = await this.ax.post("/game_metadata", {
        game: GAMESENSE_GAME_NAME,
        game_display_name: GAMESENSE_GAME_DESCRIPTION,
        developer: GAMESENSE_GAME_DEVELOPER,
      });

      await this.ax.post("/bind_game_event", {
        game: GAMESENSE_GAME_NAME,
        event: "UPTICK",
        value_optional: true,
        handlers: [
          {
            "device-type": "rgb-per-key-zones",
            "mode": "color",
            "zone": "all",
            "color": {"red": 0, "green": 255, "blue": 0}
          },
          {
            "device-type": "indicator",
            "mode": "color",
            "zone": "all",
            "color": {"red": 0, "green": 255, "blue": 0}
          }          
        ]
      });
    
      await this.ax.post("/bind_game_event", {
        game: GAMESENSE_GAME_NAME,
        event: "DNTICK",
        value_optional: true,
        handlers: [
          {
            "device-type": "rgb-per-key-zones",
            "mode": "color",
            "zone": "all",
            "color": {"red": 255, "green": 0, "blue": 0}
          },
          {
            "device-type": "indicator",
            "mode": "color",
            "zone": "all",
            "color": {"red": 255, "green": 0, "blue": 0}
          }          
        ]
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
    this.ax.post("/game_heartbeat", {
      game: GAMESENSE_GAME_NAME,
    });
  };

  updateOLED = async (rect: Electron.Rectangle, img: Electron.NativeImage): Promise<void> => {
    const bmp = img.getBitmap();
    for(let y=rect.y; y < (rect.y+rect.height); y++) {
      for(let x=rect.x; x < (rect.x+rect.width); x++) {
        const srcIndex = y*(this.width*4) + (x*4);
        const destIndex = (y*this.width) + x;
        const srcVal = (bmp[srcIndex] + bmp[srcIndex+1] + bmp[srcIndex+2]) >= (128*3);
        this.bitmapBuffer[destIndex] = srcVal ? 1 : 0;
      }
    }
    
    const evt = {
      game: GAMESENSE_GAME_NAME,
      event: 'SCREENUPDATE',
      data: {
        frame: {
          'image-data-128x40': [...create(this.bitmapBuffer)]
        }
      }
    };

    await this.ax.post("/game_event", evt).catch((err) => {
      console.error(err);
    });
  };

  clearOLED = async (): Promise<void> => {
    await this.updateOLED({
      height: this.height,
      width: this.width,
      x: 0,
      y: 0
    } as Electron.Rectangle, nativeImage.createEmpty());
  };

  triggerEvent = async (event: string): Promise<void> => {
    await this.ax.post("/game_event", {
      game: GAMESENSE_GAME_NAME,
      event,
      data: {}
    }).catch((err) => {
      console.error(err);
    });
  };

  async dispose(): Promise<void> {
    if(this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    await this.clearOLED();
    await this.ax.post("/remove_game", {
      game: GAMESENSE_GAME_NAME,
    });
  }

  async register(): Promise<void> {
    console.log("register");
  }
}
