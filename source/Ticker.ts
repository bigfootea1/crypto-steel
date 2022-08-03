import path from "path";
import fs from "fs";
import { app, powerMonitor } from "electron";
import kracken from "./gotKracken";
import EventEmitter from "events";
import _ from "lodash";
import { WebSocket, MessageEvent } from "ws";
import log, { handleError } from "./utils";

const PUBLIC_WSS_URL = "wss://ws.kraken.com";

type Config = {
  base: string;
  quote: string;
  updateRate: number;
};

const defaultConfig: Config = {
  base: "BTC",
  quote: "USD",
  updateRate: 0,
};

type OHLCUpdate = [
  channelId: number,
  data: number[],
  channelName: string,
  pair: string
];

type GenericKrackenEvent = {
  event: string;
};

export type TickerUpdate = {
  open: number;
  close: number;
  diff: number;
  delta: number;
  base: string;
  quote: string;
};

export default class Ticker extends EventEmitter {
  private ws: WebSocket;

  private _assets: any[];
  private subscription: any;

  private config: Config;

  private lastClose: number;

  private sentinelTimer: NodeJS.Timer;

  constructor() {
    super();

    powerMonitor.on("suspend", () => this.onSuspend());
    powerMonitor.on("resume", () => this.onResume());

    this.loadConfig();

    this.startSentinel();
  }

  private connect() {
    this.disconnect();

    this.ws = new WebSocket(PUBLIC_WSS_URL);
    this.ws.onopen = this.onOpen;
    this.ws.onclose = this.onClose;
    this.ws.onerror = this.onError;
    this.ws.onmessage = this.onMessage;
  }

  private disconnect() {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
  }

  private startSentinel() {
    this.stopSentinel();
    this.sentinelTimer = setInterval(() => this.sentinel(), 2000);
  }

  private stopSentinel() {
    if(this.sentinelTimer) {
      clearInterval(this.sentinelTimer);
      this.sentinelTimer = null;
    }
  }

  get pairs(): any[] {
    return this._assets;
  }

  get coinMap(): any {
    const val: any = {};
    const quoteCoins = _.map(
      _.sortBy(_.uniqBy(this._assets, "quote"), "quote"),
      "quote"
    );
    _.forEach(
      quoteCoins,
      (quote) =>
        (val[quote] = _.mapKeys(
          _.sortBy(_.filter(this._assets, { quote }), "base"),
          "base"
        ))
    );
    return val;
  }

  get base(): string {
    return this.config.base;
  }

  get quote(): string {
    return this.config.quote;
  }

  private sentinel() {
    if(!this.ws || (this.ws.readyState !== WebSocket.OPEN)) {
      this.log(`WebSocket Connecting from ReadyState ${this.ws ? this.ws.readyState : 'NULL'}...`);
      this.connect();
    }
  }

  private onSuspend = (): void => {
    this.log("onSuspend");
    this.disconnect();
    this.stopSentinel();
  };

  private onResume = (): void => {
    this.log("onResume");
    this.startSentinel();
  };

  private parsePair(pairString: string): { base: string; quote: string } {
    const pair = pairString.split("/");
    const base = pair[0] === "XBT" ? "BTC" : pair[0];
    const quote = pair[1] === "XBT" ? "BTC" : pair[1];
    return {
      base,
      quote,
    };
  }

  private loadConfig(): void {
    const configPath = path.join(app.getPath("userData"), ".config");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig));
    }
    this.config = JSON.parse(fs.readFileSync(configPath).toString());
  }

  private saveConfig() {
    const configPath = path.join(app.getPath("userData"), ".config");
    fs.writeFileSync(configPath, JSON.stringify(this.config));
  }

  private log(...args: any[]) {
    log.silly(...args);
  }

  async initialize(): Promise<void> {
    const assets: any = await kracken("AssetPairs", {
      headers: {
        "Accept-Encoding": "gzip",
      },
    })
      .json<any[]>()
      .catch((err: Error): any[] => {
        handleError("Ticker.initialize", err);
        return [];
      });

    this._assets = _.map(assets.result, (a) => {
      const { base, quote } = this.parsePair(a.wsname);
      return {
        base,
        quote,
        pair: `${base}/${quote}`,
      };
    });

    this.subscribe(this.config.base, this.config.quote);
  }

  async dispose(): Promise<void> {
    this.stopSentinel();
    this.disconnect();
  }

  private onOpen = (): void => {
    this.log("OPENED: ", this.config);
    this.emit("connected");

    this.ws.send(
      JSON.stringify({
        event: "subscribe",
        pair: [`${this.config.base}/${this.config.quote}`],
        subscription: {
          name: "ohlc",
        },
      })
    );
  };

  private onClose = (evt: any): void => {
    this.log("WEBSOCKET CLOSED: ", evt);
    this.emit("closed");
  };

  private onError = (): void => {
    this.disconnect();
  };

  private onMessage = (msg: MessageEvent): void => {
    const msgData: OHLCUpdate | GenericKrackenEvent = JSON.parse(
      msg.data as string
    );
    if (msgData instanceof Array) {
      this.tickerUpdate(msgData);
    } else if ((msgData as any) instanceof Object) {
      _.invoke(this, msgData.event, msgData);
    } else {
      handleError("Ticker.onMessage", "Unsupported response type.");
    }
  };

  private tickerUpdate = (data: OHLCUpdate): void => {
    const open = data[1][2];
    const close = data[1][5];

    const { base, quote } = this.parsePair(data[3]);

    if (!this.lastClose) {
      this.lastClose = close;
    }

    const diff = close - this.lastClose;
    const delta = (diff / open) * 100;

    const newTicker: TickerUpdate = {
      open,
      close,
      diff,
      delta,
      base,
      quote,
    };

    this.lastClose = close;

    this.log("TICKER: ", newTicker);
    this.emit("update", newTicker);
  };

  private heartbeat = (): void => {
    this.emit("heartbeat");
  };

  private systemStatus = (data: any): void => {
    this.log("STATUS: ", data);
    this.emit("status", data);
  };

  private subscriptionStatus = (data: any): void => {
    if (data.status === "subscribed") {
      this.log("SUBSCRIBED: ", data);
      this.subscription = data;
    }
    if (data.status === "unsubscribed") {
      this.log("UNSUBSCRIBED: ", data);
      if (
        data.channelName === this.subscription.channelName &&
        data.pair === this.subscription.pair
      ) {
        this.subscription = undefined;
      }
    }
    this.emit(data.status, data);
  };

  public subscribe = (base: string, quote: string): void => {

    if(this.ws && (this.ws.readyState === WebSocket.OPEN)) {
      this.ws.send(
        JSON.stringify({
          event: "unsubscribe",
          pair: [`${this.config.base}/${this.config.quote}`],
          subscription: {
            name: "ohlc",
          },
        })
      );
    }

    this.config.base = base;
    this.config.quote = quote;

    if (!_.has(this.coinMap[this.config.quote], this.config.base)) {
      if (_.has(this.coinMap[this.config.quote], "BTC")) {
        this.config.base = "BTC";
      } else {
        const k = _.keys(this.coinMap[this.config.quote]);
        this.config.base = _.head(k);
      }
    }

    this.saveConfig();

    if(this.ws && (this.ws.readyState === WebSocket.OPEN)) {
      this.ws.send(
        JSON.stringify({
          event: "subscribe",
          pair: [`${this.config.base}/${this.config.quote}`],
          subscription: {
            name: "ohlc",
          },
        })
      );
    }
  };
}
