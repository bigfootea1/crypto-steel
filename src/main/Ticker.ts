import EventEmitter from "events";
import { MessageEvent, WebSocket } from "ws";
import kracken from "./gotKracken";
import log, {
  handleError,
  normalizePair,
  parsePair,
} from "./utils";

import filter from "lodash/filter";
import forEach from "lodash/forEach";
import invoke from "lodash/invoke";
import map from "lodash/map";
import has from "lodash/has";
import mapKeys from "lodash/mapKeys";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";

import { setTimeout } from "timers/promises";
import keys from "lodash/keys";
import { TickerUpdate } from "../types/ticker";

const PUBLIC_WSS_URL = "wss://ws.kraken.com";

type OHLCUpdate = [
  channelId: number,
  data: [
    time: string,
    etime: string,
    open: string,
    high: string,
    low: string,
    close: string,
    vwap: string,
    volume: string,
    count: string
  ],
  channelName: string,
  pair: string
];

type GenericKrackenEvent = {
  event: string;
};

export type Subscription = {
  channelID: number;
  channelName: string;
  event: string;
  pair: string;
  status: string;
  subscription: { interval: number; name: string };
};

export default class Ticker extends EventEmitter {
  private ws: WebSocket;

  private _assets: any[];
  private subscription: Record<number, Subscription> = {};
  private _coinMap: any;

  private suspended: boolean;

  constructor() {
    super();
  }

  public async loadAssets(): Promise<void> {
    const assets: any = await kracken("AssetPairs")
      .json<any[]>()
      .catch((): any[] => []);

    this._assets = map(assets.result, (a) => {
      const { base, quote } = parsePair(a.wsname);
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
    log.debug("Ticker.resume");
    this.suspended = false;
    await this.connect();
  };

  public async suspend(): Promise<void> {
    log.debug("Ticker.suspend");
    this.suspended = true;
    await this.disconnect();
  }

  public subscribe = async (pair: string, interval = 1): Promise<void> => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const { base, quote } = parsePair(pair);
      const intervalPair = `${base}/${quote}/${interval}`;
      if (!has(this.subscription, intervalPair)) {
        const splitPair = parsePair(intervalPair);
        const pair = [`${splitPair.base}/${splitPair.quote}`];

        this.ws.send(
          JSON.stringify({
            event: "subscribe",
            pair,
            subscription: {
              interval,
              name: "ohlc",
            },
          })
        );
      }
    }
  };

  public unsubscribe = async (pair: string, interval = 1): Promise<void> => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const { base, quote } = parsePair(pair);
      const intervalPair = `${base}/${quote}/${interval}`;
      if (has(this.subscription, intervalPair)) {
        const splitPair = parsePair(intervalPair);
        const pair = [`${splitPair.base}/${splitPair.quote}`];

        this.ws.send(
          JSON.stringify({
            event: "unsubscribe",
            pair,
            subscription: {
              interval,
              name: "ohlc",
            },
          })
        );
      }
    }
  };

  private async connect() {
    if (!this.ws && !this.suspended) {
      log.debug("Ticker.connect");

      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(PUBLIC_WSS_URL);

        this.ws.once("open", resolve);
        this.ws.once("close", reject);
        this.ws.once("error", reject);

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
      this.ws.terminate();
      this.ws = null;
    }
  }

  private async retryConnection() {
    if (!this.suspended) {
      log.debug("...Scheduling connection retry");
      await setTimeout(2000);

      log.debug("...connection retry");
      await this.connect();
    }
  }

  private onOpen = (): void => {
    log.debug("Ticker.onOpen");
    this.emit("connected");
  };

  private onClose = async (): Promise<void> => {
    log.debug(`Ticker.onClose`);
    this.emit("closed");
    this.subscription = {};
    this.ws = null;

    await this.retryConnection();
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

  private tickerUpdate = (update: OHLCUpdate): void => {
    const starttime = parseFloat(update[1][0]);
    const endtime = parseFloat(update[1][1]);
    const open = parseFloat(update[1][2]);
    const high = parseFloat(update[1][3]);
    const low = parseFloat(update[1][4]);
    const close = parseFloat(update[1][5]);
    const vwap = parseFloat(update[1][6]);
    const volume = parseFloat(update[1][7]);
    const channel = update[2];
    const interval = parseInt(update[2].split('-')[1]);

    const { base, quote } = parsePair(update[3]);

    const newTicker: TickerUpdate = {
      starttime,
      endtime,
      open,
      high,
      low,
      close,
      vwap,
      volume,
      base,
      quote,
      interval,
      channel
    };

    // log.debug("TICKER: ", newTicker);
    this.emit("update", newTicker);
  };

  private heartbeat = (): void => {
    this.emit("heartbeat");
  };

  private systemStatus = (data: any): void => {
    // log.debug("STATUS: ", data);
    this.emit("status-change", data);
  };

  private subscriptionStatus = async (data: any): Promise<void> => {
    
    if (data.status === "subscribed") {
      log.debug(`SUBSCRIBED: ${data.channelID} - ${data.pair} - ${data.channelName}`);
      const pair = normalizePair(data.pair);
      this.subscription[`${pair}/${data.subscription.interval}`] = data;
    }

    if (data.status === "unsubscribed") {
      log.debug(`UNSUBSCRIBED: ${data.channelID} - ${data.pair} - ${data.channelName}`);
      const pair = normalizePair(data.pair);
      delete this.subscription[`${pair}/${data.subscription.interval}`];
    }

    this.emit(data.status, data);
  };
}
