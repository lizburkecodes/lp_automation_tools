const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

app.whenReady().then(async () => {
  // Load .env and ESM modules
  await import("dotenv/config");
  const { login } = await import("./src/login.js");
  const { runMilestoneReport } = await import("./src/reports/milestoneReport.js");
  const { chromium } = await import("playwright");

  const COMPANIES = {
    ArmorVue: process.env.ARMORVUE_URL,
    NewSouth: process.env.NEWSOUTH_URL,
  };

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

  // Load the HTML directly as a file — contextBridge works reliably with file://
  mainWindow.loadFile(path.join(__dirname, "src/public/index.html"));
  mainWindow.setMenuBarVisibility(false);

  // ── IPC: Save dialog ───────────────────────────────────────────────────────
  ipcMain.handle("show-save-dialog", async (_event, defaultName) => {
    try {
      // Force window to the absolute front before opening the dialog
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.show();
      mainWindow.focus();
      app.focus({ steal: true });
      await new Promise((r) => setTimeout(r, 150));
      mainWindow.setAlwaysOnTop(false);

      const downloadsPath = app.getPath("downloads");
      const { filePath, canceled } = await dialog.showSaveDialog(null, {
        title: "Save Report As",
        defaultPath: path.join(downloadsPath, defaultName || "report.xlsx"),
        filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
      });
      return { filePath: filePath || null, cancelled: canceled };
    } catch (err) {
      console.error("Save dialog error:", err);
      return { filePath: null, cancelled: true };
    }
  });

  // ── IPC: Run automation ────────────────────────────────────────────────────
  ipcMain.handle("run-process", async (_event, { company, username, password, process: selectedProcess, savePath, opts }) => {
    if (!COMPANIES[company]) throw new Error("Unknown company selected.");
    if (!username || !password) throw new Error("Username and password are required.");

    const finalSavePath = savePath || path.join(app.getPath("downloads"), "report.xlsx");

    console.log(`\n🚀 Starting "${selectedProcess}" for ${company}...`);

    let browser;
    try {
      browser = await chromium.launch({ headless: false });
      const page = await login(browser, COMPANIES[company], username, password);

      if (selectedProcess === "Milestone Report") {
        await runMilestoneReport(page, finalSavePath, opts);
      } else {
        throw new Error(`Unknown process: ${selectedProcess}`);
      }

      return { message: `"${selectedProcess}" completed successfully.` };
    } finally {
      if (browser) await browser.close();
      // Give macOS a moment to settle after Chromium closes, then restore focus
      await new Promise((r) => setTimeout(r, 300));
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.show();
        mainWindow.focus();
        app.focus({ steal: true });
        await new Promise((r) => setTimeout(r, 150));
        mainWindow.setAlwaysOnTop(false);
      }
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
