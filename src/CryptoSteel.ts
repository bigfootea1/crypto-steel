import _ from "lodash";
import path from "path";
import fs from "fs";
import { BrowserWindow, app, Tray, Menu, NativeImage } from "electron";
import { getIcon } from "./utils";

import Ticker from "./Ticker";
import GameSense from "./GameSense";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

const DEBUG_OFFSCREEN_BROWSER = true;

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
  private effects: GameSense;

  private config: Config = defaultConfig;

  private renderWindow: BrowserWindow;

  constructor() {
    this.tray = new Tray(getIcon());
    this.ticker = new Ticker();
    this.effects = new GameSense();
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
      { label: "Quit", type: "normal", click: async () => {
        await this.dispose();
        app.quit();
      } },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private createRenderWindow() {
    // Create the browser window.
    this.renderWindow = new BrowserWindow({
      width: 128,
      height: 40,
      minWidth: 128,
      minHeight: 40,
      minimizable: false,
      maximizable: false,
      transparent: true,
      alwaysOnTop: DEBUG_OFFSCREEN_BROWSER,
      show: DEBUG_OFFSCREEN_BROWSER,
      frame: false,
      resizable: false,
      // useContentSize: true,
      // backgroundColor: '#000',
      webPreferences: { 
        offscreen: !DEBUG_OFFSCREEN_BROWSER, 
        nodeIntegration: true,
        preload: path.join(__dirname, 'preload.js') 
      } 
    });

    this.renderWindow.webContents.on("paint", (event, dirty, image: NativeImage) => {
      this.effects.updateOLED(dirty, image);
    });

    this.renderWindow.webContents.setFrameRate(10);

    if(DEBUG_OFFSCREEN_BROWSER) {
      this.renderWindow.webContents.openDevTools();
    }

    this.renderWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  }
  
  async initialize(): Promise<void> {
    await this.ticker.initialize();
    await this.effects.initialize();
    this.loadConfig();
    this.updateMenu();
    this.createRenderWindow();
  }

  async dispose(): Promise<void> {
    console.log('Disposing ticker...');
    await this.ticker.dispose();
    console.log('Disposing effects...');
    await this.effects.dispose();
    console.log('Destroying tray...');
    this.tray.destroy();
  }
}
