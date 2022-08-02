import { app } from "electron";
import CryptoSteel from "./CryptoSteel";

let cryptosteel: CryptoSteel;

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("ready", async () => {
  cryptosteel = new CryptoSteel();
  await cryptosteel.initialize();
});
