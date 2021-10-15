"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const GameSense_1 = __importDefault(require("./GameSense"));
const Ticker_1 = __importDefault(require("./Ticker"));
const utils_1 = require("./utils");
const DEBUG_OFFSCREEN_BROWSER = false;
const DEVTOOLS_ENABLED = true || DEBUG_OFFSCREEN_BROWSER;
const DEBUG_EFFECTS = true;
class CryptoSteel {
    constructor() {
        this.onTickerUpdate = (data) => {
            if (this.renderWindow) {
                this.renderWindow.webContents.send('tickerupdate', data);
            }
        };
        this.onHeartbeat = () => {
            if (this.renderWindow) {
                this.renderWindow.webContents.send('heartbeat');
            }
        };
        electron_1.app.setAppLogsPath();
        this.tray = new electron_1.Tray((0, utils_1.getIcon)());
        this.ticker = new Ticker_1.default();
        this.effects = new GameSense_1.default();
        this.ticker.on('update', this.onTickerUpdate);
        this.ticker.on('heartbeat', this.onHeartbeat);
        // ipcMain.on('update', () => {
        //   console.log('update request from browser');
        // });
    }
    updateMenu() {
        const quoteSubmenu = lodash_1.default.map(lodash_1.default.keys(this.ticker.coinMap), (q) => {
            return {
                label: q,
                type: "checkbox",
                checked: q === this.ticker.quote,
                click: (item) => {
                    this.ticker.subscribe(this.ticker.base, item.label);
                    this.updateMenu();
                },
            };
        });
        const baseSubmenu = lodash_1.default.map(this.ticker.coinMap[this.ticker.quote], (q) => {
            return {
                label: q.base,
                type: "checkbox",
                checked: q.base === this.ticker.base,
                click: (item) => {
                    this.ticker.subscribe(item.label, this.ticker.quote);
                    this.updateMenu();
                },
            };
        });
        const menuItemList = [];
        menuItemList.push({ icon: (0, utils_1.getIcon)(this.ticker.base), label: `Coin`, type: "submenu", submenu: baseSubmenu });
        menuItemList.push({ icon: (0, utils_1.getIcon)(this.ticker.quote), label: `Currency`, type: "submenu", submenu: quoteSubmenu });
        if (DEBUG_EFFECTS) {
            menuItemList.push({ type: "separator" });
            menuItemList.push({ label: "Trigger UPTICK", type: "normal", click: async () => await this.effects.triggerEvent("UPTICK") });
            menuItemList.push({ label: "Trigger DNTICK", type: "normal", click: async () => await this.effects.triggerEvent("DNTICK") });
        }
        menuItemList.push({ type: "separator" });
        menuItemList.push({ label: "Quit", type: "normal", click: async () => {
                await this.dispose();
                electron_1.app.quit();
            } });
        const contextMenu = electron_1.Menu.buildFromTemplate(menuItemList);
        this.tray.setContextMenu(contextMenu);
        this.tray.setImage((0, utils_1.getIcon)(this.ticker.base));
    }
    createRenderWindow() {
        // Create the browser window.
        this.renderWindow = new electron_1.BrowserWindow({
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
                preload: path_1.default.join(__dirname, 'preload.js')
            }
        });
        this.renderWindow.webContents.on("paint", (event, dirty, image) => {
            this.effects.updateOLED(dirty, image);
        });
        this.renderWindow.webContents.setFrameRate(10);
        if (DEBUG_OFFSCREEN_BROWSER || DEVTOOLS_ENABLED) {
            this.renderWindow.webContents.openDevTools();
        }
        this.renderWindow.loadFile(path_1.default.join(__dirname, "../static/html/index.html"));
    }
    async initialize() {
        await this.ticker.initialize();
        await this.effects.initialize();
        this.updateMenu();
        this.createRenderWindow();
    }
    async dispose() {
        await this.ticker.dispose();
        await this.effects.dispose();
        this.tray.destroy();
    }
}
exports.default = CryptoSteel;
//# sourceMappingURL=CryptoSteel.js.map