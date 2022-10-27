import fs from "fs";
import os from "os";
import got from 'got';

const GAMESENSE_CONFIG_LOCATION =
  os.platform() === "win32"
    ? `${process.env.ProgramData}\\SteelSeries\\SteelSeries Engine 3\\coreProps.json`
    : "/Library/Application Support/SteelSeries Engine 3/coreProps.json";

const cfg = JSON.parse(
    fs.readFileSync(GAMESENSE_CONFIG_LOCATION).toString()
  );

const gamesense = got.extend({ 
    prefixUrl: `http://${cfg.address}`, 
    headers: { "content-type": "application/json" },
    method: "POST"
});

export default gamesense;
