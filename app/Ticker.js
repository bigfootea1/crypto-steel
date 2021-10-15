"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const electron_1 = require("electron");
const events_1 = __importDefault(require("events"));
const lodash_1 = __importDefault(require("lodash"));
const reconnecting_websocket_1 = __importDefault(require("reconnecting-websocket"));
const ws_1 = __importDefault(require("ws"));
const PUBLIC_REST_URL = "https://api.kraken.com/0/public/";
const PUBLIC_WSS_URL = "wss://ws.kraken.com";
const defaultConfig = {
    base: "BTC",
    quote: "USD",
    updateRate: 0,
};
class Ticker extends events_1.default {
    constructor() {
        super();
        this.onSuspend = () => {
            console.log('SUSPENDING');
            this.ws.close();
        };
        this.onResume = () => {
            console.log('RESUMING');
            this.ws.reconnect();
        };
        this.onOpen = () => {
            console.log("OPENED: ", this.config);
            this.emit("connected");
            this.ws.send(JSON.stringify({
                event: "subscribe",
                pair: [`${this.config.base}/${this.config.quote}`],
                subscription: {
                    name: "ohlc",
                },
            }));
        };
        this.onClose = () => {
            this.emit("closed");
        };
        this.onError = (err) => {
            this.emit("error", err);
        };
        this.onMessage = (msg) => {
            const msgData = JSON.parse(msg.data);
            if (msgData instanceof Array) {
                this.tickerUpdate(msgData);
            }
            else if (msgData instanceof Object) {
                lodash_1.default.invoke(this, msgData.event, msgData);
            }
            else {
                console.error("Unsupported response type.");
            }
        };
        this.tickerUpdate = (data) => {
            const open = data[1][2];
            const close = data[1][5];
            const diff = close - open;
            const delta = (diff / open) * 100;
            const { base, quote } = this.parsePair(data[3]);
            console.log('TICKER: ', data);
            this.emit("update", {
                open,
                close,
                diff,
                delta,
                base,
                quote,
            });
        };
        this.heartbeat = () => {
            this.emit("heartbeat");
        };
        this.systemStatus = (data) => {
            console.log("STATUS: ", data);
            this.emit("status", data);
        };
        this.subscriptionStatus = (data) => {
            if (data.status === "subscribed") {
                console.log("SUBSCRIBED: ", data);
                this.subscription = data;
            }
            if (data.status === "unsubscribed") {
                console.log("UNSUBSCRIBED: ", data);
                if (data.channelName === this.subscription.channelName &&
                    data.pair === this.subscription.pair) {
                    this.subscription = undefined;
                }
            }
            this.emit(data.status, data);
        };
        this.subscribe = (base, quote) => {
            this.config.base = base;
            this.config.quote = quote;
            if (!lodash_1.default.has(this.coinMap[this.config.quote], this.config.base)) {
                if (lodash_1.default.has(this.coinMap[this.config.quote], 'BTC')) {
                    this.config.base = 'BTC';
                }
                else {
                    const k = lodash_1.default.keys(this.coinMap[this.config.quote]);
                    this.config.base = lodash_1.default.head(k);
                }
            }
            this.saveConfig();
            this.ws.reconnect();
        };
        process.on("uncaughtException", function (error) {
            console.error("ERROR HERE: ", error);
        });
        this.ws = new reconnecting_websocket_1.default(PUBLIC_WSS_URL, [], {
            WebSocket: ws_1.default,
            startClosed: true
        });
        this.ws.onopen = this.onOpen;
        this.ws.onclose = this.onClose;
        this.ws.onerror = this.onError;
        this.ws.onmessage = this.onMessage;
        electron_1.powerMonitor.on("suspend", () => this.onSuspend());
        electron_1.powerMonitor.on("resume", () => this.onResume());
        this.loadConfig();
    }
    get pairs() {
        return this._assets;
    }
    get coinMap() {
        const val = {};
        const quoteCoins = lodash_1.default.map(lodash_1.default.sortBy(lodash_1.default.uniqBy(this._assets, "quote"), "quote"), "quote");
        lodash_1.default.forEach(quoteCoins, (quote) => (val[quote] = lodash_1.default.mapKeys(lodash_1.default.sortBy(lodash_1.default.filter(this._assets, { quote }), "base"), "base")));
        return val;
    }
    get base() {
        return this.config.base;
    }
    get quote() {
        return this.config.quote;
    }
    parsePair(pairString) {
        const pair = pairString.split("/");
        const base = pair[0] === "XBT" ? "BTC" : pair[0];
        const quote = pair[1] === "XBT" ? "BTC" : pair[1];
        return {
            base,
            quote,
        };
    }
    loadConfig() {
        const configPath = path_1.default.join(electron_1.app.getPath("userData"), ".config");
        if (!fs_1.default.existsSync(configPath)) {
            fs_1.default.writeFileSync(configPath, JSON.stringify(defaultConfig));
        }
        this.config = JSON.parse(fs_1.default.readFileSync(configPath).toString());
    }
    saveConfig() {
        const configPath = path_1.default.join(electron_1.app.getPath("userData"), ".config");
        fs_1.default.writeFileSync(configPath, JSON.stringify(this.config));
    }
    async initialize() {
        const assets = await axios_1.default
            .get("AssetPairs", {
            baseURL: PUBLIC_REST_URL,
            maxContentLength: 1000000,
            maxBodyLength: 1000000,
            maxRedirects: 0,
            headers: {
                "Accept-Encoding": "gzip",
            },
        })
            .then((r) => r.data.result)
            .catch((err) => {
            console.error(err);
            return [];
        });
        this._assets = lodash_1.default.map(assets, (a) => {
            const { base, quote } = this.parsePair(a.wsname);
            return {
                base,
                quote,
                pair: `${base}/${quote}`,
            };
        });
        this.subscribe(this.config.base, this.config.quote);
    }
    async dispose() {
        if (this.ws.readyState === reconnecting_websocket_1.default.OPEN) {
            return new Promise((resolve) => {
                this.ws.addEventListener("close", () => {
                    resolve();
                });
                this.ws.close(1000);
            });
        }
    }
}
exports.default = Ticker;
//# sourceMappingURL=Ticker.js.map