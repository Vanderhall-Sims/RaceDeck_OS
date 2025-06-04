const { app, BrowserWindow, screen } = require('electron');
const AutoLaunch = require('auto-launch');

const appLauncher = new AutoLaunch({
  name: 'Stream Deck Enhanced',
  path: app.getPath('exe'),
});
appLauncher.enable().catch(err => console.error("Auto-launch error:", err));

function createWindow() {
  const displays = screen.getAllDisplays();

  // ✅ Use the smallest screen (touchscreen), fallback to primary
  const touchscreen = displays.find(d => d.bounds.width <= 1080 && d.bounds.height <= 800) || screen.getPrimaryDisplay();
  const { x, y, width, height } = touchscreen.bounds;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // ✅ Prevent flicker on launch
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
});

