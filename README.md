# Crypto-Steel

**See your Crypto assets in real-time on your APEX Pro Keyboard Display**

This application runs in the background in your system tray.  You can select a coin and "quote" (ie: the currency to quote the coin in) combo.  The real-time price and 24 hour running price graph are presented in a rotating display on the APEX OLED.

## Pre-Requisites

You should have the SteelSeries GG application loaded and running, and your keyboard and prism cloth should be working as normal.  If the app doesnt find the StellSeries GG driver on your system, it will default to "Debugging Mode" wherein it will create a "virtual display" on your monitor.  This will allow you to see what the ticker would otherwise render on your APEX keyboard OLED display.

## How To Install

Download the appropriate executable from the releases in github and run it.  The executable will automatically install and create a desktop icon.  Once the app is running you should see it in your tray.

Right click on the icon and select which coin(s) you wish to track.  You can select *multiple* coins if you wish, but you can only select one "quote" currency.

## Developers

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer. From your command line:

```bash
# Clone this repository
git clone https://github.com/bigfootea1/crypto-steel.git
# Go into the repository
cd crypto-steel
# Install dependencies
npm install
# Run the app
npm run start
```

## Technology

This app is written in TypeScript and node.js, running in the Electron.JS environment.  It also uses REACT, WebSockets, Electron, and REST interfaces.

### Hardware

The hardware interface to the app is provided by the SteelSeries GG driver, utilizing the STeelSeries GameSense SDK.  The driver is essentially a standard HTTP endpoint running on your local machine at `localhost` and a specified port.  The SDK is documented in the SteelSeries repo [here](https://github.com/SteelSeries/gamesense-sdk).

### Software

This app is comprised of the main process which is responsible for the interface to the target platform (ie: Windows, Mac), and then several Rendering processes.  One rendering process is responsible for rendering the bitmap content on the APEX OLED screen.  The other rendering process is responsible for rendering lighting effects on the APEX keyboard.

A "renderer" is an offscreen electron browser window.  The bitmap contents of that window are then rasterized and color-converted into the proper format for the APEX OLED screen, and pushed to the screen through the GameSense SDK.  The same thing is done for the keyboard, wherein the bitmap contents of the rendered browser window are rasterized and then sent to the keyboard lighting controller via the Gamesense SDK.

The content for the ticker and graph screens are implemented using REACT, with hooks implemented to provide updated state whenever a ticker update is received via the WebSocket interface.

### Real-Time Data

The ticker data for the cryptocurreny values are provided by the public, non-authenticated [Kracken API](https://docs.kraken.com/websockets/).  This API consists of a standard REST interface, coupled with a persistent WebSocket which is used to push ticker updates down to the various renderers.

## License

[CC0 1.0 (Public Domain)](LICENSE.md)
