import * as XLSX from "xlsx";
import { join } from "path";
import os from "os";

/**
 * Runs the Milestone Report for the given authenticated page.
 *
 * @param {import('playwright').Page} page - An already-authenticated CRM page
 * @param {string} [savePath] - Full path where the .xlsx should be saved (defaults to Downloads)
 * @param {object} [opts] - Options passed from the UI: startDate, endDate (mm/dd/yyyy)
 */
export async function runMilestoneReport(page, savePath, opts = {}) {
  if (!savePath) {
    savePath = join(os.homedir(), "Downloads", "milestone-report.xlsx");
  }

  const { MARKET, MILESTONE, REPORT_NAME } = process.env;
  const START_DATE = opts.startDate || process.env.START_DATE;
  const END_DATE = opts.endDate || process.env.END_DATE;

  const requiredValues = { START_DATE, END_DATE, MARKET, MILESTONE, REPORT_NAME };
  for (const [key, value] of Object.entries(requiredValues)) {
    if (!value) throw new Error(`Missing value: ${key}`);
  }

  await page.getByText("Reports", { exact: true }).click();
  await page.getByText("Report Generator", { exact: true }).click();

  await page.waitForSelector("#ReportGroup", { timeout: 30000 });

  await page.selectOption("#ReportGroup", "Production");
  await page.waitForTimeout(2000);

  await page.selectOption("#ReportName", REPORT_NAME);
  await page.waitForTimeout(1000);

  await page.evaluate(
    ({ START_DATE, END_DATE }) => {
      const start = document.querySelector("#TextBox1");
      const end = document.querySelector("#TextBox2");

      start.value = START_DATE;
      end.value = END_DATE;

      start.dispatchEvent(new Event("input", { bubbles: true }));
      start.dispatchEvent(new Event("change", { bubbles: true }));
      end.dispatchEvent(new Event("input", { bubbles: true }));
      end.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { START_DATE, END_DATE }
  );

  await page.selectOption("#DropDown1", MILESTONE);
  await page.selectOption("#DropDown2", MARKET);
  await page.selectOption("#rFormat", "HTML-T");

  const reportPagePromise = page.waitForEvent("popup");
  await page.click("#buttonGo");
  const reportPage = await reportPagePromise;

  await reportPage.waitForLoadState("domcontentloaded");
  await reportPage.waitForSelector("table", { timeout: 30000 });

  const rawRows = await reportPage.$$eval("table tr", (trs) =>
    trs
      .map((tr) =>
        Array.from(tr.querySelectorAll("td")).map((td) =>
          td.innerText.trim().replace(/\s+/g, " ")
        )
      )
      .filter((row) => row.length > 0)
  );

  const cleanedRows = rawRows
    .filter((row) => /^\d+$/.test(row[0]))
    .map((row) => ({
      "Job Number": row[0],
      "Customer Name": row[1],
      Address: row[2],
      City: row[3],
      "Job Scheduled": row[4],
      Market: row[6],
      Product: row[7],
      "Total Gross": row[8],
      "Job Cost": row[9],
      "Total Paid": row[10],
      "Balance Due": row[11],
    }));

  const worksheet = XLSX.utils.json_to_sheet(cleanedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Milestone Report");
  XLSX.writeFile(workbook, savePath);

  console.log(`✅ Saved ${cleanedRows.length} jobs to ${savePath}`);
}
