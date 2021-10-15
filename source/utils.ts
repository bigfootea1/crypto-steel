import path from 'path';
import { nativeImage } from "electron";

export function getIcon( symbol?: string, scale?: number ): Electron.NativeImage {
    let icon;
    if(symbol) {
        icon = nativeImage.createFromPath(path.join(__dirname, '..', 'static', 'assets', 'color', `${symbol.toLowerCase()}.png`));        
    }

    if(!icon || icon.isEmpty()) {
        icon = nativeImage.createFromPath(path.join(__dirname, '..', 'static', 'assets', 'color', 'generic.png'));
    }

    if(scale) {
        const sz = icon.getSize();
        icon = icon.resize({
            width: sz.width * scale,
            height: sz.height * scale,
        });
    }

    return icon;
}

