import fs from "fs";
import os from "os";
import got, { Got } from "got";
import { GAMESENSE_GAME_NAME } from "../../types/constants";

const GAMESENSE_CONFIG_LOCATION =
  os.platform() === "win32"
    ? `${process.env.ProgramData}\\SteelSeries\\SteelSeries Engine 3\\coreProps.json`
    : "/Library/Application Support/SteelSeries Engine 3/coreProps.json";

let gamesenseActive = false;

let cfg;
try {
  const fileData = fs.readFileSync(GAMESENSE_CONFIG_LOCATION).toString();
  cfg = JSON.parse(fileData);
} catch (err) {
  console.log("Could not load config file");
}

export const gamesense: Got = got.extend({
  prefixUrl: `http://${cfg?.address || "localhost"}`,
  headers: { "content-type": "application/json" },
  method: "POST",
});

export async function initGameSense(): Promise<boolean> {
  try {
    if (gamesense) {
      await gamesense("game_heartbeat", {
        json: {
          game: GAMESENSE_GAME_NAME,
        },
      }).then(() => gamesenseActive = true);
    }
  } catch (err) {
    /// Failure means no gamesense
    gamesenseActive = false;   
    console.log("Heartbeat to GameSense Failed...DISABLING GameSense");
  }
  return gamesenseActive;
}

export function hasGameSense(): boolean {
  return gamesenseActive;
}

export default gamesense;
