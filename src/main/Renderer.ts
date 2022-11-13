import { BrowserWindow, NativeImage, Rectangle } from "electron";
import EventEmitter from "events";
import path from "path";
import { TickerUpdate } from "../types/ticker";
import log from "./utils";

const ZOOM_FACTOR = 4;

export interface RendererConfig {
  width: number;
  height: number;
  preload: string;
  url: string;
  onPaint?: (event: any, dirty: Rectangle, image: NativeImage) => void;
  onscreen?: boolean;
  devTools?: boolean;
  x?: number;
  y?: number;
  positionBelow?: Renderer;
}

export default class Renderer extends EventEmitter {
  private renderWindow: BrowserWindow;

  constructor(private config: RendererConfig) {
    super();
    log.info("Renderer.constructor");
  }

  private getZoom() {
    return (this.config.onscreen) ? ZOOM_FACTOR : 1;
  }

  public suspend = async (): Promise<void> => {
    if (this.renderWindow) {
      log.info("Renderer.suspend");
      this.renderWindow.close();
      this.renderWindow = null;
    }
  };

  public resume = async (): Promise<void> => {
    if (!this.renderWindow) {
      log.info("Renderer.resume");

      const width = this.config.width * this.getZoom();
      const height = this.config.height * this.getZoom();

      // Create the browser window.
      this.renderWindow = new BrowserWindow({
        x: this.config.x,
        y: this.config.y,
        width,
        height,
        useContentSize: true,
        minimizable: false,
        maximizable: false,
        transparent: false,
        fullscreenable: false,
        titleBarStyle: 'hidden',
        alwaysOnTop: this.config.onscreen,
        show: false,
        frame: false,
        resizable: false,
        backgroundColor: "black",
        webPreferences: {
          offscreen: !this.config.onscreen,
          textAreasAreResizable: false,
          nodeIntegration: true,
          contextIsolation: true,
          preload: path.join(__dirname, "../../app", this.config.preload),
        },
      });

      if (this.config.devTools || this.config.onscreen) {
        this.renderWindow.webContents.openDevTools();
      }

      this.renderWindow.once("ready-to-show", () => {
        this.renderWindow.webContents.setZoomFactor(this.getZoom());
        this.renderWindow.webContents.setFrameRate(20);

        if(this.config.positionBelow && this.config.onscreen) {
          const bounds = this.config.positionBelow.renderWindow.getNormalBounds();
          this.renderWindow.setBounds({ x: bounds.x, y: bounds.y + bounds.height});
        }

        if (this.config.onPaint) {
          this.renderWindow.webContents.on("paint", this.config.onPaint);
        }
  
        if (this.config.onscreen) {
          this.renderWindow.show();
        }
      });

      await this.renderWindow.webContents.loadFile(
        path.join(__dirname, "../../app", this.config.url)
      );
    }
  };

  public send(channel: string, data: TickerUpdate | any): void {
    this.renderWindow.webContents.send(channel.toLowerCase(), data);
  }

}
