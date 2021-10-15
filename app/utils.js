"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIcon = void 0;
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
function getIcon(symbol, scale) {
    let icon;
    if (symbol) {
        icon = electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, '..', 'static', 'assets', 'color', `${symbol.toLowerCase()}.png`));
    }
    if (!icon || icon.isEmpty()) {
        icon = electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, '..', 'static', 'assets', 'color', 'generic.png'));
    }
    if (scale) {
        const sz = icon.getSize();
        icon = icon.resize({
            width: sz.width * scale,
            height: sz.height * scale,
        });
    }
    return icon;
}
exports.getIcon = getIcon;
//# sourceMappingURL=utils.js.map