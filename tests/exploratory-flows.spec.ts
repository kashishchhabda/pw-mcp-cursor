import { test, expect } from '@playwright/test';

const SALESFORCE_LOGIN = 'https://test.salesforce.com/';

// Credentials – override via env: SEED_USER, SEED_PASSWORD
const SEED_USER = process.env.SEED_USER || 'msaini@horizontal.jumeirah.qa';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Jumeirah2026@@';

/** Shared: log in to Salesforce Sandbox and wait for home. */
async function loginToSalesforce(page: import('@playwright/test').Page) {
  await page.goto(SALESFORCE_LOGIN);
  await page.getByRole('textbox', { name: 'Username' }).fill(SEED_USER);
  await page.getByRole('textbox', { name: 'Password' }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
  await expect(page).toHaveURL(/\/(lightning|home)/, { timeout: 20000 });
}

async function openNavigationMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Show Navigation Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation Menu' })).toBeVisible({
    timeout: 10000,
  });
}

async function openDestination(
  page: import('@playwright/test').Page,
  destination: 'Cases' | 'Contacts'
) {
  const topLink = page.getByRole('link', { name: destination, exact: true });
  if (await topLink.isVisible().catch(() => false)) {
    await topLink.click();
    return;
  }

  await openNavigationMenu(page);
  await page.getByRole('menuitem', { name: destination, exact: true }).click();
}

test.describe('Exploratory flows – Salesforce Sandbox', () => {
  test('Flow 1: Login only', async ({ page }) => {
    await loginToSalesforce(page);
    await expect(page).toHaveURL(/\/(lightning|home)/);
  });

  test('Flow 2: Login → App Launcher → Cases', async ({ page }) => {
    await loginToSalesforce(page);
    await openDestination(page, 'Cases');
    await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Flow 3: Login → App Launcher → Contacts', async ({ page }) => {
    await loginToSalesforce(page);
    await openDestination(page, 'Contacts');
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Flow 4: Login → App Launcher search', async ({ page }) => {
    await loginToSalesforce(page);
    const appLauncher = page.getByRole('button', { name: /App Launcher|Apps/i }).or(page.locator('button[title*="App Launcher"]'));
    await appLauncher.click();
    const searchInput = page.getByPlaceholder(/Search apps and items|Search/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Case');
    await expect(page.getByText(/Case/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Flow 5: Login → direct Contact record URL', async ({ page }) => {
    await loginToSalesforce(page);
    const contactRecordUrl = process.env.CONTACT_RECORD_URL || 'https://jumeirahinternational2--qa.sandbox.lightning.force.com/lightning/r/Contact/003WL00000cC4d3YAC/view';
    await page.goto(contactRecordUrl);
    await expect(page).toHaveURL(/\/Contact\/.+\/view/);
    await expect(page.locator('h1').or(page.getByRole('heading').first())).toBeVisible({ timeout: 15000 });
  });
});
