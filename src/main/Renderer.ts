import { BrowserWindow, NativeImage, Rectangle } from "electron";
import EventEmitter from "events";
import path from "path";
import { ZOOM_FACTOR } from "../types/constants";
import { TickerUpdate } from "../types/ticker";
import log from "./utils";

export interface RendererConfig {
  width: number;
  height: number;
  preload: string;
  url: string;
  onPaint?: (event: any, dirty: Rectangle, image: NativeImage) => void;
  onscreen?: boolean;
  devTools?: boolean;
  positionBelow?: Renderer;
}

export default class Renderer extends EventEmitter {
  private renderWindow: BrowserWindow;

  constructor(private config: RendererConfig) {
    super();
    log.info(`Renderer.constructor: ${this.config.url}`);
  }

  private getZoom() {
    return (this.config.onscreen) ? ZOOM_FACTOR : 1;
  }

  public suspend = async (): Promise<void> => {
    if (this.renderWindow) {
      log.info(`Renderer.suspend: ${this.config.url}`);
      this.renderWindow.close();
      this.renderWindow = null;
    }
  };

  public resume = async (): Promise<void> => {
    if (!this.renderWindow) {
      log.info(`Renderer.resume: ${this.config.url}`);

      const width = this.config.width * this.getZoom();
      const height = this.config.height * this.getZoom();

      // Create the browser window.
      this.renderWindow = new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        minimizable: false,
        maximizable: false,
        transparent: false,
        fullscreenable: false,
        titleBarStyle: 'hidden',
        alwaysOnTop: this.config.onscreen,
        show: false,
        frame: false,
        resizable: true,
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
        this.renderWindow.webContents.setFrameRate(30);

        if(this.config.positionBelow && this.config.onscreen) {
          const bounds = this.config.positionBelow.renderWindow.getNormalBounds();
          this.renderWindow.setBounds({ x: bounds.x, y: bounds.y + bounds.height});
        }

        if (this.config.onPaint) {
          this.renderWindow.webContents.on("paint", this.config.onPaint);
        }

        this.renderWindow.setSize(this.config.width, this.config.height);

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
