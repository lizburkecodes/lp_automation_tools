const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");

// Expose Electron APIs to the Express server (which runs in this same process)
global.electronDialog = dialog;
global.electronApp = app;

// Start the Express server
require("./server.cjs");

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: false,
    title: "LeadPerfection Automation",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
    },
  });

  mainWindow.loadURL("http://localhost:3000");
  mainWindow.setMenuBarVisibility(false);

  global.mainWindow = mainWindow;

  // IPC handler — direct channel from page → main process, no HTTP involved
  ipcMain.handle("show-save-dialog", async (_event, defaultName) => {
    const downloadsPath = app.getPath("downloads");
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: "Save Report As",
      defaultPath: path.join(downloadsPath, defaultName || "report.xlsx"),
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });
    return { filePath: filePath || null, cancelled: canceled };
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
