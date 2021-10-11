import { nativeImage } from "electron";

export function getIcon( symbol?: string ): Electron.NativeImage {
    const icon = nativeImage.createFromPath(`src/assets/color/${symbol}.png`);
    if(!icon || icon.isEmpty()) {
        return nativeImage.createFromPath(`src/assets/color/generic.png`);
    }
    return icon;
}

