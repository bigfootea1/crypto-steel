// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const { ipcRenderer } = require("electron");

// let tickerData: any;
// let dirty = false;

// function updateTicker() {
//   if (dirty && tickerData) {
//     let price;

//     try {
//       price = new Intl.NumberFormat("en-US", {
//         style: "currency",
//         currency: tickerData.quote,
//         currencyDisplay: "narrowSymbol",
//         maximumFractionDigits: 2,
//       }).format(tickerData.close);
//     } catch (err) {
//       price = new Intl.NumberFormat("en-US", {
//         style: "decimal",
//         maximumFractionDigits: 2,
//       }).format(tickerData.close);
//     }

//     document.getElementById("price").innerText = price;
//     document.getElementById(
//       "quote"
//     ).innerText = `${tickerData.base} / ${tickerData.quote}`;
//     document.getElementById(
//       "logo"
//     ).className = `tickerLogo cf cf-${tickerData.base.toLowerCase()}`;
//     dirty = false;
//   }
// }

// ipcRenderer.on("tickerupdate", (sender: any, data: any) => {
//   tickerData = data;
//   dirty = true;
// });

// ipcRenderer.on("heartbeat", () => {
//   window.tickerAPI.getCurrentData();
//   updateTicker();
// });

// ipcRenderer.send("update");

window.tickerAPI.getCurrentData();