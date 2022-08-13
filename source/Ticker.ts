import path from "path";
import fs from "fs";
import { app } from "electron";
import kracken from "./gotKracken";
import EventEmitter from "events";
import { WebSocket, MessageEvent } from "ws";
import log, { handleError } from "./utils";

import map from "lodash/map";
import uniqBy from "lodash/uniqBy";
import sortBy from "lodash/sortBy";
import forEach from "lodash/forEach";
import mapKeys from "lodash/mapKeys";
import filter from "lodash/filter";
import invoke from "lodash/invoke";
import has from "lodash/has";
import head from "lodash/head";
import keys from "lodash/keys";

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
  private _coinMap: any;

  private config: Config;

  private lastClose: number;

  private reconnectTimer: NodeJS.Timeout;
  private suspended: boolean;

  constructor() {
    super();
    this.loadConfig();
  }

  public async loadAssets(): Promise<void> {
    const assets: any = await kracken("AssetPairs", {
      headers: {
        "Accept-Encoding": "gzip",
      },
    })
      .json<any[]>()
      .catch((): any[] => []);

    this._assets = map(assets.result, (a) => {
      const { base, quote } = this.parsePair(a.wsname);
      return {
        base,
        quote,
        pair: `${base}/${quote}`,
      };
    });

    const quoteCoins = map(
      sortBy(uniqBy(this._assets, "quote"), "quote"),
      "quote"
    );

    this._coinMap = {};
    forEach(
      quoteCoins,
      (quote) =>
        (this._coinMap[quote] = mapKeys(
          sortBy(filter(this._assets, { quote }), "base"),
          "base"
        ))
    );
  }

  public get pairs(): any[] {
    return this._assets;
  }

  public get coinMap(): any {
    return this._coinMap;
  }

  public get base(): string {
    return this.config.base;
  }

  public get quote(): string {
    return this.config.quote;
  }

  public resume = async (): Promise<void> => {
    this.suspended = false;
    this.connect();
  };

  public async suspend(): Promise<void> {
    this.suspended = true;
    this.disconnect();
  }

  public subscribe = (base: string, quote: string): void => {
    this.config.base = base;
    this.config.quote = quote;

    if (!has(this.coinMap[this.config.quote], this.config.base)) {
      if (has(this.coinMap[this.config.quote], "BTC")) {
        this.config.base = "BTC";
      } else {
        const k = keys(this.coinMap[this.config.quote]);
        this.config.base = head(k);
      }
    }

    this.saveConfig();

    this.unsubscribe();

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

  private async connect() {
    if(!this.ws) {
      log.info("Ticker.connect");

      this.ws = new WebSocket(PUBLIC_WSS_URL);
      this.ws.onopen = this.onOpen;
      this.ws.onclose = this.onClose;
      this.ws.onerror = this.onError;
      this.ws.onmessage = this.onMessage;
    }
  }

  private disconnect() {
    if (this.ws) {
      log.info("Ticker.disconnect");
      this.ws.close();
      this.ws.terminate();
      this.ws = null;

      if(this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }
  }

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
    log.verbose("Ticker.loadConfig");
    const configPath = path.join(app.getPath("userData"), ".config");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig));
    }
    this.config = JSON.parse(fs.readFileSync(configPath).toString());
  }

  private saveConfig() {
    log.verbose("Ticker.saveConfig");
    const configPath = path.join(app.getPath("userData"), ".config");
    fs.writeFileSync(configPath, JSON.stringify(this.config));
  }

  private retryConnection() {
    if(this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if(!this.suspended) {
      log.debug('...Scheduling connection retry');
      this.reconnectTimer = setTimeout(() => {
        log.debug('...connection retry');
        this.connect();
      }, 2000);
    }
  }

  private onOpen = (): void => {
    log.info(`Ticker.onOpen ${JSON.stringify(this.config)}`);
    this.emit("connected");
  };

  private onClose = (evt: any): void => {
    log.info(`Ticker.onClose ${JSON.stringify(evt)}`);
    this.emit("closed");
    this.subscription = undefined;
    this.ws = null;

    this.retryConnection();
  };

  private onError = (err: any): void => {
    log.info(`Ticker.onError ${JSON.stringify(err)}`);
  };

  private onMessage = (msg: MessageEvent): void => {
    const msgData: OHLCUpdate | GenericKrackenEvent = JSON.parse(
      msg.data as string
    );
    if (msgData instanceof Array) {
      this.tickerUpdate(msgData);
    } else if ((msgData as any) instanceof Object) {
      invoke(this, msgData.event, msgData);
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

    log.debug("TICKER: ", newTicker);
    this.emit("update", newTicker);
  };

  private heartbeat = (): void => {
    this.emit("heartbeat");
  };

  private systemStatus = (data: any): void => {
    log.info("STATUS: ", data);
    this.emit("status", data);
    if(data.status === 'online') {
      this.subscribe(this.config.base, this.config.quote);
    }
  };

  private subscriptionStatus = (data: any): void => {
    if (data.status === "subscribed") {
      log.info("SUBSCRIBED: ", data);
      this.subscription = data;
    }
    if (data.status === "unsubscribed") {
      log.info("UNSUBSCRIBED: ", data);
      if (
        data.channelName === this.subscription.channelName &&
        data.pair === this.subscription.pair
      ) {
        this.subscription = undefined;
      }
    }
    this.emit(data.status, data);
  };

  private unsubscribe(): void {
    if(this.ws 
      && (this.ws.readyState === WebSocket.OPEN)
      && this.subscription
      && this.subscription.channelID
      ) {
      this.ws.send(
        JSON.stringify({
          event: "unsubscribe",
          channelID: this.subscription.channelID,
        })
      );
    }
  }

}
