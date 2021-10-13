import axios from "axios";
import { powerMonitor } from "electron";
import EventEmitter from "events";
import _ from "lodash";
import ReconnectingWebSocket from "reconnecting-websocket";
import WS from "ws";

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
  private ws: ReconnectingWebSocket;

  private _assets: any[];
  private subscription: any;

  private base: string;
  private quote: string;

  constructor() {
    super();

    process.on("uncaughtException", function (error) {
      console.error("ERROR HERE: ", error);
    });

    this.ws = new ReconnectingWebSocket(PUBLIC_WSS_URL, [], {
      WebSocket: WS,
      startClosed: true
    });

    this.ws.onopen = this.onOpen;
    this.ws.onclose = this.onClose;
    this.ws.onerror = this.onError;
    this.ws.onmessage = this.onMessage;

    powerMonitor.on("suspend", () => this.onSuspend());
    powerMonitor.on("resume", () => this.onResume());

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

  onSuspend = (): void => {
    console.log('SUSPENDING');
    this.ws.close();
  };

  onResume = (): void => {
    console.log('RESUMING');
    this.ws.reconnect();
  };

  parsePair(pairString: string): { base: string; quote: string } {
    const pair = pairString.split("/");
    const base = pair[0] === "XBT" ? "BTC" : pair[0];
    const quote = pair[1] === "XBT" ? "BTC" : pair[1];
    return {
      base,
      quote,
    };
  }

  async initialize(): Promise<void> {
    const assets = await axios
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

    this._assets = _.map(assets, (a) => {
      const { base, quote } = this.parsePair(a.wsname);
      return {
        base,
        quote,
        pair: `${base}/${quote}`,
      };
    });
  }

  async dispose(): Promise<void> {
    if (this.ws.readyState === ReconnectingWebSocket.OPEN) {
      return new Promise((resolve) => {
        this.ws.addEventListener("close", () => {
          resolve();
        });
        this.ws.close(1000);
      });
    }
  }

  private onOpen = (): void => {
    this.emit("connected");

    this.ws.send(
      JSON.stringify({
        event: "subscribe",
        pair: [`${this.base}/${this.quote}`],
        subscription: {
          name: "ohlc",
        },
      })
    );
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
    const diff = close - open;
    const delta = (diff / open) * 100;

    const { base, quote } = this.parsePair(this.subscription.pair);

    this.emit("update", {
      open,
      close,
      diff,
      delta,
      base,
      quote,
    });
  };

  private heartbeat = (): void => {
    this.emit("heartbeat");
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
    this.base = base;
    this.quote = quote;
    this.ws.reconnect();
  };
}
