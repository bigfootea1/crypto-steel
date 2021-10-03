import _ from "lodash";
import path from "path";
import fs from "fs";
import { app, Tray, Menu } from "electron";
import { getIcon } from "./utils";

import Ticker from "./Ticker";
import GameSenseAPI from "./GameSenseAPI";

export interface Config {
  base: string;
  quote: string;
  updateRate: number;
}

const defaultConfig: Config = {
  base: "BTC",
  quote: "USD",
  updateRate: 0,
};

export default class CryptoSteel {
  private tray: Tray;
  private ticker: Ticker;
  private effects: GameSenseAPI;

  private config: Config = defaultConfig;

  constructor() {
    this.tray = new Tray(getIcon());
    this.ticker = new Ticker();

    this.effects = new GameSenseAPI();
  }

  private loadConfig(): void {
    const configPath = path.join(app.getPath("userData"), ".config");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig));
    }
    this.config = JSON.parse(fs.readFileSync(configPath).toString());

    if(!_.has(this.ticker.coinMap[this.config.quote], this.config.base)) {
      if(_.has(this.ticker.coinMap[this.config.quote], 'BTC')) {
        this.config.base = 'BTC';
      }
      else {
        const k = _.keys(this.ticker.coinMap[this.config.quote]);
        this.config.base = _.head(k);
      }
    }

    this.tray.setImage(getIcon(this.config.base));
    this.ticker.subscribe(this.config.base, this.config.quote);
  }

  private saveConfig() {
    const configPath = path.join(app.getPath("userData"), ".config");
    fs.writeFileSync(configPath, JSON.stringify(this.config));
    this.loadConfig();
  }

  private configChanged() {
    this.saveConfig();
    this.updateMenu();
  }

  updateMenu(): void {

    const quoteSubmenu = _.map(_.keys(this.ticker.coinMap), (q) => {
      return {
        label: q,
        type: "checkbox",
        checked: q === this.config.quote,
        click: (item: any) => {
          this.config.quote = item.label;
          this.configChanged();
        },
      };
    });

    const baseSubmenu = _.map(this.ticker.coinMap[this.config.quote], (q) => {
      return {
        label: q.base,
        type: "checkbox",
        checked: q.base === this.config.base,
        click: (item: any) => {
          this.config.base = item.label;
          this.configChanged();
        },
      };
    });

    const contextMenu = Menu.buildFromTemplate([
      { icon: getIcon(this.config.base), label: `Coin`, type: "submenu", submenu: baseSubmenu as any },
      { icon: getIcon(this.config.quote), label: `Currency`, type: "submenu", submenu: quoteSubmenu as any },
      { type: "separator" },
      { label: "Quit", type: "normal", role: "quit" },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  async initialize(): Promise<void> {
    await this.ticker.initialize();
    await this.effects.initialize();
    this.loadConfig();
    this.updateMenu();
  }

  dispose(): void {
    if (this.ticker) {
      this.ticker.dispose();
    }
    this.tray.destroy();
  }
}
