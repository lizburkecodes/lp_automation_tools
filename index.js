import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import os from "os";
import { chromium } from "playwright";
import "dotenv/config";
import { login } from "./src/login.js";
import { runMilestoneReport } from "./src/reports/milestoneReport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Company config ────────────────────────────────────────────────────────────
const COMPANIES = {
  ArmorVue: process.env.ARMORVUE_URL,
  NewSouth:  process.env.NEWSOUTH_URL,
};

if (!COMPANIES.ArmorVue || !COMPANIES.NewSouth) {
  throw new Error("Missing ARMORVUE_URL or NEWSOUTH_URL in .env");
}

// ── Express server ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "src/public")));

app.post("/choose-save-path", async (req, res) => {
  const defaultName = req.body.defaultName || "report.xlsx";

  const electronDialog = globalThis.electronDialog;
  const electronApp = globalThis.electronApp;
  const parentWindow = globalThis.mainWindow ?? null;

  if (electronDialog && electronApp) {
    try {
      const downloadsPath = electronApp.getPath("downloads");
      const { filePath, canceled } = await electronDialog.showSaveDialog(parentWindow, {
        title: "Save Report As",
        defaultPath: join(downloadsPath, defaultName),
        filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
      });
      res.json({ savePath: filePath || null, cancelled: canceled });
    } catch (err) {
      console.error("Dialog error:", err);
      res.status(500).json({ error: "Failed to open save dialog: " + err.message });
    }
  } else {
    // Not running in Electron — return default Downloads path
    res.json({ savePath: join(os.homedir(), "Downloads", defaultName), cancelled: false });
  }
});

app.post("/run", async (req, res) => {
  const { company, username, password, process: selectedProcess, savePath, opts } = req.body;

  if (!COMPANIES[company]) {
    return res.status(400).json({ error: "Unknown company selected." });
  }
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  console.log(`\n🚀 Starting "${selectedProcess}" for ${company}...`);

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const page = await login(browser, COMPANIES[company], username, password);

    if (selectedProcess === "Milestone Report") {
      await runMilestoneReport(page, savePath, opts);
    }
    // Add more process handlers here as you build them out:
    // else if (selectedProcess === "Another Report") { await runAnotherReport(page); }
    else {
      return res.status(400).json({ error: `Unknown process: ${selectedProcess}` });
    }

    res.json({ message: `"${selectedProcess}" completed successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Automation UI ready → http://localhost:${PORT}`);
  console.log("   Open that URL in your browser to get started.\n");
});