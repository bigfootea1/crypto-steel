import EventEmitter from "events";
import { MessageEvent, WebSocket } from "ws";
import kracken from "./gotKracken";
import log, { handleError } from "./utils";

import filter from "lodash/filter";
import forEach from "lodash/forEach";
import invoke from "lodash/invoke";
import map from "lodash/map";
import mapKeys from "lodash/mapKeys";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";

const PUBLIC_WSS_URL = "wss://ws.kraken.com";

type OHLCUpdate = [
  channelId: number,
  data: string[],
  channelName: string,
  pair: string
];

type Subscription = {
  channelID: number,
  channelName: string,
  event: string,
  pair: string,
  status: string,
  subscription: { interval: number, name: string }
};

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
  private subscription: Record<number, Subscription> = {};
  private _coinMap: any;

  private lastClose: Record< string, number > = {};

  private reconnectTimer: NodeJS.Timeout;
  private suspended: boolean;

  constructor() {
    super();
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

  public resume = async (): Promise<void> => {
    this.suspended = false;
    await this.connect();
  };

  public async suspend(): Promise<void> {
    this.suspended = true;
    await this.disconnect();
  }

  public subscribe = async (base: string[], quote: string): Promise<void> => {
    this.unsubscribe();
    if(this.ws && (this.ws.readyState === WebSocket.OPEN)) {
      const pairList = map(base, (b) => `${b}/${quote}`);
      this.ws.send(
        JSON.stringify({
          event: "subscribe",
          pair: pairList,
          subscription: {
            name: "ohlc",
          },
        })
      );
    }
  };

  private async connect() {
    if(!this.ws) {
      log.debug("Ticker.connect");

      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(PUBLIC_WSS_URL);

        this.ws.once('open', resolve);
        this.ws.once('close', reject);
        this.ws.once('error', reject);

        this.ws.onopen = this.onOpen;
        this.ws.onclose = this.onClose;
        this.ws.onerror = this.onError;
        this.ws.onmessage = this.onMessage;
      });
    }
  }

  private async disconnect() {
    if (this.ws) {
      log.debug("Ticker.disconnect");

      if(this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      return new Promise((resolve) => {
        this.ws.once('open', resolve);
        this.ws.once('close', resolve);
        this.ws.once('error', resolve);
        this.ws.close();
        this.ws.terminate();
      }).finally(() => this.ws = null);
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
    log.debug('Ticker.onOpen');
    this.emit("connected");
  };

  private onClose = (evt: any): void => {
    log.debug(`Ticker.onClose ${JSON.stringify(evt)}`);
    this.emit("closed");
    this.subscription = undefined;
    this.ws = null;

    this.retryConnection();
  };

  private onError = (err: any): void => {
    log.error(`Ticker.onError ${JSON.stringify(err)}`);
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
    const open = parseFloat(data[1][2]);
    const close = parseFloat(data[1][5]);

    const { base, quote } = this.parsePair(data[3]);
    const pair = `${base}/${quote}`;

    if (!this.lastClose[pair]) {
      this.lastClose[pair] = close;
    }

    const diff = close - this.lastClose[pair];
    const delta = (diff / open) * 100;

    const newTicker: TickerUpdate = {
      open,
      close,
      diff,
      delta,
      base,
      quote,
    };

    this.lastClose[pair] = close;

    log.debug("TICKER: ", newTicker);
    this.emit("update", newTicker);
  };

  private heartbeat = (): void => {
    this.emit("heartbeat");
  };

  private systemStatus = (data: any): void => {
    log.debug("STATUS: ", data);
    this.emit("status-change", data);
  };

  private subscriptionStatus = (data: any): void => {
    if (data.status === "subscribed") {
      log.debug(`SUBSCRIBED: ${data.channelID} - ${data.pair}`);
      this.subscription[data.channelID] = data;
    }
    if (data.status === "unsubscribed") {
      log.debug(`UNSUBSCRIBED: ${data.channelID} - ${data.pair}`);
      delete this.subscription[data.channelID];
    }
    this.emit(data.status, data);
  };

  private unsubscribe(): void {
    if(this.ws 
      && (this.ws.readyState === WebSocket.OPEN)
      ) {
        forEach(this.subscription, (sub: Subscription) => {
          this.ws.send(
            JSON.stringify({
              event: "unsubscribe",
              channelID: sub.channelID,
            })
          );
        });
    }
  }

}
