import { app, BrowserWindow, Menu, NativeImage, Tray, ipcMain } from "electron";
import fs from "fs";
import _ from "lodash";
import path from "path";
import GameSense from "./GameSense";
import Ticker from "./Ticker";
import { getIcon } from "./utils";

const DEBUG_OFFSCREEN_BROWSER = false;
const DEVTOOLS_ENABLED = true || DEBUG_OFFSCREEN_BROWSER;
const DEBUG_EFFECTS = true;

export default class CryptoSteel {
  private tray: Tray;
  private ticker: Ticker;
  private effects: GameSense;

  private renderWindow: BrowserWindow;

  constructor() {

    app.setAppLogsPath();

    this.tray = new Tray(getIcon());
    this.ticker = new Ticker();
    this.effects = new GameSense();

    this.ticker.on('update', this.onTickerUpdate);
    this.ticker.on('heartbeat', this.onHeartbeat);

    // ipcMain.on('update', () => {
    //   console.log('update request from browser');
    // });
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

  updateMenu(): void {

    const quoteSubmenu = _.map(_.keys(this.ticker.coinMap), (q) => {
      return {
        label: q,
        type: "checkbox",
        checked: q === this.ticker.quote,
        click: (item: any) => {
          this.ticker.subscribe(this.ticker.base, item.label);
          this.updateMenu();
        },
      };
    });

    const baseSubmenu = _.map(this.ticker.coinMap[this.ticker.quote], (q) => {
      return {
        label: q.base,
        type: "checkbox",
        checked: q.base === this.ticker.base,
        click: (item: any) => {
          this.ticker.subscribe(item.label, this.ticker.quote);
          this.updateMenu();
        },
      };
    });

    const menuItemList: Electron.MenuItemConstructorOptions[] = [];

    menuItemList.push({ icon: getIcon(this.ticker.base), label: `Coin`, type: "submenu", submenu: baseSubmenu as any });
    menuItemList.push({ icon: getIcon(this.ticker.quote), label: `Currency`, type: "submenu", submenu: quoteSubmenu as any });

    if(DEBUG_EFFECTS) {
      menuItemList.push({ type: "separator" });
      menuItemList.push({ label: "Trigger UPTICK", type: "normal", click: async () => await this.effects.triggerEvent("UPTICK")});
      menuItemList.push({ label: "Trigger DNTICK", type: "normal", click: async () => await this.effects.triggerEvent("DNTICK")});
    }

    menuItemList.push({ type: "separator" });
    menuItemList.push({ label: "Quit", type: "normal", click: async () => {
        await this.dispose();
        app.quit();
      } });

    const contextMenu = Menu.buildFromTemplate(menuItemList);

    this.tray.setContextMenu(contextMenu);

    this.tray.setImage(getIcon(this.ticker.base));
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

    this.renderWindow.loadFile(path.join(__dirname, "../static/html/index.html"));
  }
  
  async initialize(): Promise<void> {
    await this.ticker.initialize();
    await this.effects.initialize();
    this.updateMenu();
    this.createRenderWindow();
  }

  async dispose(): Promise<void> {
    await this.ticker.dispose();
    await this.effects.dispose();
    this.tray.destroy();
  }
}