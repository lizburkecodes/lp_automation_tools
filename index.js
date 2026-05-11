import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
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


app.post("/run", async (req, res) => {
  const { company, username, password, process: selectedProcess, opts } = req.body;

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

    let buffer;
    let filename;
    if (selectedProcess === "Jobs by Milestone Date") {
      buffer = await runMilestoneReport(page, opts);
      filename = "milestone-report.xlsx";
    }
    // Add more process handlers here:
    // else if (selectedProcess === "Another Report") { ... }
    else {
      return res.status(400).json({ error: `Unknown process: ${selectedProcess}` });
    }

    // Send the file back to the browser — the browser's download dialog handles where to save it
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
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
  console.log(`\n Automation UI ready → http://localhost:${PORT}`);
  console.log("   Open URL in your browser to get started.\n");
});