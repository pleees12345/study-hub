const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;
const isMac = process.platform === "darwin";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    title: "Study Hub",
    // hiddenInset is macOS-only; Windows/Linux use a standard title bar.
    ...(isMac ? { titleBarStyle: "hiddenInset" } : {}),
    backgroundColor: "#f7f2e9",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // On Windows/Linux show a proper native menu bar too.
  if (!isMac) {
    win.setMenuBarVisibility(true);
  }

  if (isDev) {
    win.loadURL("http://localhost:5183");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Open external links in the default browser instead of a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
