import { app, powerMonitor, Menu, Tray } from "electron";
import map from "lodash/map";
import keys from "lodash/keys";
import GameSense from "./GameSense";
import Ticker from "./Ticker";
import log, { getIcon } from "./utils";

const DEBUG_EFFECTS = false;

export default class CryptoSteel {
  private tray: Tray;
  private ticker: Ticker;
  private effects: GameSense;

  constructor() {
    app.setAppLogsPath();

    this.tray = new Tray(getIcon());

    this.ticker = new Ticker();
    this.effects = new GameSense();

    this.ticker.on('update', this.effects.onTickerUpdate);
    this.ticker.on('heartbeat', this.effects.onHeartbeat);

    powerMonitor.on("suspend", () => this.onSuspend());
    powerMonitor.on("resume", () => this.onResume());
  }

  private onSuspend = async (): Promise<void> => {
    log.info('CryptoSteel.suspend');
    await this.ticker.suspend();
    await this.effects.suspend();
  };

  private onResume = async (): Promise<void> => {
    log.info('CryptoSteel.resume');
    await this.effects.resume();
    await this.ticker.resume();
  };

  updateMenu(): void {
    log.verbose('CryptoSteel updateMenu');

    const quoteSubmenu = map(keys(this.ticker.coinMap), (q) => {
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

    const baseSubmenu = map(this.ticker.coinMap[this.ticker.quote], (q) => {
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

  async initialize(): Promise<void> {
    log.info('CryptoSteel initialize');

    await this.ticker.loadAssets();

    this.updateMenu();

    await this.effects.resume();
    await this.ticker.resume();
  }

  async dispose(): Promise<void> {
    log.info('CryptoSteel.dispose');
    this.tray.destroy();
    await this.ticker.suspend();
    await this.effects.suspend();
    log.info('CryptoSteel.disposed');
  }
}
