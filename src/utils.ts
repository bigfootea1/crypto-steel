import { nativeImage } from "electron";

export function getIcon( symbol?: string ): Electron.NativeImage {
    const icon = nativeImage.createFromPath(`assets/${symbol}.png`);
    if(!icon || icon.isEmpty()) {
        return nativeImage.createFromPath(`assets/generic.png`);
    }
    return icon;
}