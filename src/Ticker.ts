import axios, { AxiosInstance } from "axios";
import EventEmitter from "events";
import WS from "ws";
import ReconnectingWebSocket from "reconnecting-websocket";
import _ from "lodash";

const PUBLIC_REST_URL = "https://api.kraken.com/0/public/";
const PUBLIC_WSS_URL = "wss://ws.kraken.com";

export type TickerUpdate = [
  channelId: number,
  data: any,
  channelName: string,
  pair: string
];

export type OHLCUpdate = [
  channelId: number,
  data: number[],
  channelName: string,
  pair: string
];

export default class Ticker extends EventEmitter {
  private ax: AxiosInstance;
  private ws: ReconnectingWebSocket;

  private _assets: any[];

  private subscription: any;

  constructor() {
    super();

    this.ax = axios.create({
      baseURL: PUBLIC_REST_URL,
      maxContentLength: 1000000,
      maxBodyLength: 1000000,
      maxRedirects: 0,
      headers: {
        "Accept-Encoding": "gzip",
      },
    });

    this.ws = new ReconnectingWebSocket(PUBLIC_WSS_URL, [], { WebSocket: WS, startClosed: true });

    this.ws.onopen = this.onOpen;
    this.ws.onclose = this.onClose;
    this.ws.onerror = this.onError;
    this.ws.onmessage = this.onMessage;

    this.ws.reconnect();
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

  async initialize(): Promise<void> {
    const assets = await this.ax
      .get("AssetPairs")
      .then((r) => r.data.result)
      .catch((err) => {
        console.error(err);
        return [];
      });

    this._assets = _.map(assets, (a) => {
      const pair = a.wsname.split("/");
      const base = pair[0] === "XBT" ? "BTC" : pair[0];
      const quote = pair[1] === "XBT" ? "BTC" : pair[1];
      return {
        base,
        quote,
        pair: `${base}/${quote}`,
      };
    });
  }

  async dispose(): Promise<void> {
    if(this.ws.readyState === ReconnectingWebSocket.OPEN) {
      return new Promise((resolve) => {
        this.ws.addEventListener('close', () => {
          resolve();
        });
        this.ws.close(1000);
      });
    }
  }

  private onOpen = (): void => {
    this.emit("connected");
  };

  private onClose = (): void => {
    this.emit("closed");
  };

  private onError = (err: ErrorEvent): void => {
    this.emit("error", err);
  };

  private onMessage = (msg: MessageEvent<any>): void => {
    const msgData = JSON.parse(msg.data);

    if (msgData instanceof Array) {
      this.tickerUpdate(msgData as TickerUpdate);
    } else if (msgData instanceof Object) {
      _.invoke(this, msgData.event, msgData);
    } else {
      console.error("Unsupported response type.");
    }
  };

  private tickerUpdate = (data: OHLCUpdate): void => {

    const open = data[1][2];
    const close = data[1][5];
    const diff = (close - open);
    const delta = diff / open;

    // console.log(`Ticker: ${open} - ${close} - ${diff} - ${delta}`);
  };

  private heartbeat = (): void => {
    // console.log('.');
  };

  private systemStatus = (data: any): void => {
    this.emit("status", data);
  };

  private subscriptionStatus = (data: any): void => {
    if (data.status === "subscribed") {
      this.subscription = data;
    }
    if (data.status === "unsubscribed") {
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
    this.unsubscribe();
    this.ws.send(
      JSON.stringify({
        event: "subscribe",
        pair: [`${base}/${quote}`],
        subscription: {
          name: "ohlc",
        },
      })
    );
  };

  public unsubscribe = (): void => {
    if (this.subscription) {
      this.ws.send(
        JSON.stringify({
          event: "unsubscribe",
          subscription: {
            name: this.subscription.channelName,
          },
          pair: [this.subscription.pair],
        })
      );
    }
  };
}
