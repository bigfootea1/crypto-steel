import { nativeImage } from "electron";

export function getIcon( symbol?: string, mono = false ): Electron.NativeImage {
    const icon = nativeImage.createFromPath(`src/assets/${mono?'mono':'color'}/${symbol}.png`);
    if(!icon || icon.isEmpty()) {
        return nativeImage.createFromPath(`src/assets/${mono?'mono':'color'}/generic.png`);
    }
    return icon;
}

