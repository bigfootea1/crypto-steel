"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const CryptoSteel_1 = __importDefault(require("./CryptoSteel"));
let cryptosteel;
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("ready", async () => {
    cryptosteel = new CryptoSteel_1.default();
    await cryptosteel.initialize();
});
//# sourceMappingURL=main.js.map