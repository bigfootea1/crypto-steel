import path from 'path';
import log from 'electron-log';
import { nativeImage } from "electron";

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

log.transports.file.getFile().clear();

export function getIcon( symbol?: string, scale?: number ): Electron.NativeImage {
    let icon;
    if(symbol) {
        const filePath = path.join(__dirname, '..', '..', 'assets', `${symbol.toLowerCase()}.png`);
        log.info(filePath);
        icon = nativeImage.createFromPath(filePath);        
    }

    if(!icon || icon.isEmpty()) {
        icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'generic.png'));
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

export function handleError( source: string, err: string | Error): void {
    const error: Error = typeof err === 'string' ? new Error(err) : err;
    log.error(source, error.message);
}

export default log;
