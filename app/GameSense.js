"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const axios_1 = __importDefault(require("axios"));
const events_1 = __importDefault(require("events"));
// import _ from "lodash";
const buffer_1 = require("bitwise/buffer");
const electron_1 = require("electron");
const GAMESENSE_CONFIG_LOCATION = os_1.default.platform() === "win32"
    ? `${process.env.ProgramData}\\SteelSeries\\SteelSeries Engine 3\\coreProps.json`
    : "/Library/Application Support/SteelSeries Engine 3/coreProps.json";
const GAMESENSE_GAME_NAME = "CRYPTO-STEEL";
const GAMESENSE_GAME_DESCRIPTION = "Cryptocurrency Ticker";
const GAMESENSE_GAME_DEVELOPER = "Darren Schueller";
class GameSense extends events_1.default {
    constructor(width = 128, height = 40) {
        super();
        this.width = width;
        this.height = height;
        this.heartbeat = () => {
            this.ax.post("/game_heartbeat", {
                game: GAMESENSE_GAME_NAME,
            });
        };
        this.updateOLED = async (rect, img) => {
            const bmp = img.getBitmap();
            for (let y = rect.y; y < (rect.y + rect.height); y++) {
                for (let x = rect.x; x < (rect.x + rect.width); x++) {
                    const srcIndex = y * (this.width * 4) + (x * 4);
                    const destIndex = (y * this.width) + x;
                    const srcVal = (bmp[srcIndex] + bmp[srcIndex + 1] + bmp[srcIndex + 2]) >= (128 * 3);
                    this.bitmapBuffer[destIndex] = srcVal ? 1 : 0;
                }
            }
            const evt = {
                game: GAMESENSE_GAME_NAME,
                event: 'SCREENUPDATE',
                data: {
                    frame: {
                        'image-data-128x40': [...(0, buffer_1.create)(this.bitmapBuffer)]
                    }
                }
            };
            await this.ax.post("/game_event", evt).catch((err) => {
                console.error(err);
            });
        };
        this.clearOLED = async () => {
            await this.updateOLED({
                height: this.height,
                width: this.width,
                x: 0,
                y: 0
            }, electron_1.nativeImage.createEmpty());
        };
        this.triggerEvent = async (event) => {
            await this.ax.post("/game_event", {
                game: GAMESENSE_GAME_NAME,
                event,
                data: {}
            }).catch((err) => {
                console.error(err);
            });
        };
        this.bitmapBuffer = Buffer.alloc(width * height, 0);
    }
    async initialize() {
        try {
            const cfg = JSON.parse(fs_1.default.readFileSync(GAMESENSE_CONFIG_LOCATION).toString());
            this.ax = axios_1.default.create({
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
                        "zone": "ss-key",
                        "color": { "red": 0, "green": 255, "blue": 0 }
                    },
                    {
                        "device-type": "indicator",
                        "mode": "color",
                        "zone": "all",
                        "color": { "red": 0, "green": 255, "blue": 0 }
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
                        "zone": "ss-key",
                        "color": { "red": 255, "green": 0, "blue": 0 }
                    },
                    {
                        "device-type": "indicator",
                        "mode": "color",
                        "zone": "all",
                        "color": { "red": 255, "green": 0, "blue": 0 }
                    }
                ]
            });
            this.heartbeatTimer = setInterval(this.heartbeat, ggInfo.data.game_metadata.deinitialize_timer_length_ms - 2000);
        }
        catch (err) {
            console.error(err);
        }
    }
    async dispose() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        await this.clearOLED();
        await this.ax.post("/remove_game", {
            game: GAMESENSE_GAME_NAME,
        });
    }
    async register() {
        console.log("register");
    }
}
exports.default = GameSense;
//# sourceMappingURL=GameSense.js.map