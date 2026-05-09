/**
 * Logs into the LeadPerfection CRM and returns the authenticated page.
 * @param {import('playwright').Browser} browser
 * @param {string} loginUrl
 * @param {string} username
 * @param {string} password
 * @returns {Promise<import('playwright').Page>}
 */
export async function login(browser, loginUrl, username, password) {
  const page = await browser.newPage();

  await page.goto(loginUrl);
  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', password);
  await page.click('input[type="submit"], button[type="submit"]');
  await page.waitForLoadState("networkidle");

  return page;
}
