import { app } from 'electron';
import CryptoSteel from './CryptoSteel';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let cryptosteel: CryptoSteel;

app.on('ready', async () => {
  cryptosteel = new CryptoSteel();
  await cryptosteel.initialize();
});

app.on('before-quit', () => {
  if(cryptosteel) {
    cryptosteel.dispose();
  }
});

