import { app, BrowserWindow, Menu, NativeImage, Tray } from "electron";
import fs from "fs";
import _ from "lodash";
import path from "path";
import GameSense from "./GameSense";
import Ticker from "./Ticker";
import { getIcon } from "./utils";

const DEBUG_OFFSCREEN_BROWSER = false;
const DEVTOOLS_ENABLED = false;

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

    this.ticker.on('update', this.onTickerUpdate);
    this.ticker.on('heartbeat', this.onHeartbeat);
  }

  private onTickerUpdate = (data: any) => {
    if(this.renderWindow) {
      this.renderWindow.webContents.send('tickerupdate', data);
    }
  };

  private onHeartbeat = () => {
    if(this.renderWindow) {
      this.renderWindow.webContents.send('heartbeat');
    }
  };

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
      resizable: true,
      webPreferences: {
        offscreen: !DEBUG_OFFSCREEN_BROWSER, 
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js') 
      } 
    });

    this.renderWindow.webContents.on("paint", (event, dirty, image: NativeImage) => {
      this.effects.updateOLED(dirty, image);
    });

    this.renderWindow.webContents.setFrameRate(10);

    if(DEBUG_OFFSCREEN_BROWSER || DEVTOOLS_ENABLED) {
      this.renderWindow.webContents.openDevTools();
    }

    this.renderWindow.loadFile(path.join(__dirname, "../index.html"));
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
