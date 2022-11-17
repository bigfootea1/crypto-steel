import { app, Menu, MenuItem, Tray } from "electron";
import EventEmitter from "events";
import fs from "fs";
import find from "lodash/find";
import has from "lodash/has";
import head from "lodash/head";
import keys from "lodash/keys";
import map from "lodash/map";
import filter from "lodash/filter";
import isEqual from "lodash/isEqual";
import path from "path";
import log, { getIcon } from "./utils";

const DEBUG_EFFECTS = false;

export type CoinMap = Record<string, any>;

type Config = {
  base: string[];
  quote: string;
};

const defaultConfig: Config = {
  base: ["BTC", "ETH"],
  quote: "USD"
};

export default class App extends EventEmitter {
  private tray: Tray;
  private config: Config;
  private contextMenu: Electron.Menu;
  private quoteSubmenu: Electron.MenuItemConstructorOptions;
  private baseSubmenu: Electron.MenuItemConstructorOptions;

  private menuItemList: Electron.MenuItemConstructorOptions[] = [
    {
      id: "coin-submenu",
      icon: getIcon(),
      label: `Coin`,
      type: "submenu",
      submenu: [],
    },
    {
      id: "currency-submenu",
      icon: getIcon(),
      label: `Currency`,
      type: "submenu",
      submenu: [],
    },
    {
      label: "Trigger UPTICK",
      type: "normal",
      click: () => this.emit("uptick"),
      visible: DEBUG_EFFECTS,
    },
    {
      label: "Trigger DNTICK",
      type: "normal",
      click: () => this.emit("uptick"),
      visible: DEBUG_EFFECTS,
    },
    {
      type: "separator",
    },
    {
      label: "Quit",
      type: "normal",
      click: () => this.emit("quit"),
    },
  ];
  
  constructor(private coinMap: CoinMap) {
    super();

    this.loadConfig();

    this.tray = new Tray(getIcon());

    this.quoteSubmenu = find(this.menuItemList, { id: 'currency-submenu'});
    this.baseSubmenu = find(this.menuItemList, { id: 'coin-submenu'});

    this.updateMenu();
  }

  public get base(): string[] {
    return this.config.base;
  }

  public get quote(): string {
    return this.config.quote;
  }

  private updateMenu() {
    this.quoteSubmenu.submenu = map(keys(this.coinMap), (q) => ({
      id: `quote-${q}`,
      label: q,
      type: "checkbox",
      checked: this.config.quote === q,
      click: (item: MenuItem) => { 
        this.setPairs(item.label, this.config.base);
      },
      icon: getIcon(q)
    }));

    this.baseSubmenu.submenu = map(this.coinMap[this.config.quote], (q) => ({
      id: `base-${q.base}`,
      label: q.base,
      type: "checkbox",
      checked: this.config.base.includes(q.base),
      click: () => {
        const menuItems = this.contextMenu.getMenuItemById('coin-submenu').submenu.items;
        this.setPairs(this.config.quote, map(filter(menuItems, { checked: true}), (m: any) => m.label));
      },
      icon: getIcon(q.base)
    }));

    this.quoteSubmenu.icon = getIcon(this.config.quote);
    this.baseSubmenu.icon = getIcon();

    this.contextMenu = Menu.buildFromTemplate(this.menuItemList);

    this.tray.setContextMenu(this.contextMenu);
    // this.tray.setImage(getIcon(this.config.base));
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

  private setPairs(quote: string, base: string[]) {
    if (!isEqual(this.config.base,base) || this.config.quote !== quote) {

      const prevQuote = this.config.quote;
      const prevBase = this.config.base.slice();

      const validCoins = filter(base, (coin: string) => has(this.coinMap[quote], coin));
      this.config.base = validCoins;

      if(validCoins.length === 0) {
        const k = keys(this.coinMap[quote]);
        this.config.base = [head(k)];
      }

      this.config.quote = quote;
      this.saveConfig();

      this.emit("config-change", { base: prevBase, quote: prevQuote }, this.config);
    }
    this.updateMenu();
  }
}
