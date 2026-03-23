import { test, expect } from '@playwright/test';

const SALESFORCE_LOGIN_URL = 'https://test.salesforce.com/';
const SEED_USER = process.env.SEED_USER || 'msaini@horizontal.jumeirah.qa';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Jumeirah2026@@';
const CONTACT_RECORD_URL = process.env.CONTACT_RECORD_URL;

async function login(page: import('@playwright/test').Page) {
  const username = page.locator('#username').or(page.getByRole('textbox', { name: 'Username' }));
  const password = page.locator('#password').or(page.getByRole('textbox', { name: 'Password' }));
  const loginButton = page.getByRole('button', { name: /Log In to Sandbox|Log In/i });

  await page.goto(SALESFORCE_LOGIN_URL);
  await username.fill(SEED_USER);
  await password.fill(SEED_PASSWORD);
  await loginButton.click();
  await expect(page).toHaveURL(/\/(lightning|home)/, { timeout: 20_000 });
}

async function openAppLauncher(page: import('@playwright/test').Page) {
  const appLauncher = page
    .getByRole('button', { name: /App Launcher|Apps/i })
    .or(page.locator('button[title*="App Launcher"]'));

  await appLauncher.click();
  await expect(page.getByPlaceholder(/Search apps and items|Search/i)).toBeVisible({
    timeout: 10_000,
  });
}

async function openFromAppLauncher(
  page: import('@playwright/test').Page,
  itemName: 'Cases' | 'Contacts'
) {
  const searchInput = page.getByPlaceholder(/Search apps and items|Search/i);
  await searchInput.fill(itemName);
  await page.getByRole('link', { name: itemName, exact: true }).first().click();
}

test.describe('Seed exploratory flows', () => {
  test('login reaches Salesforce home', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(lightning|home)/);
  });

  test('app launcher opens after login', async ({ page }) => {
    await login(page);
    await openAppLauncher(page);
    await expect(page.getByPlaceholder(/Search apps and items|Search/i)).toBeVisible();
  });

  test('navigate to Cases from app launcher search', async ({ page }) => {
    await login(page);
    await openAppLauncher(page);
    await openFromAppLauncher(page, 'Cases');
    await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('navigate to Contacts from app launcher search', async ({ page }) => {
    await login(page);
    await openAppLauncher(page);
    await openFromAppLauncher(page, 'Contacts');
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('user menu is available after login', async ({ page }) => {
    await login(page);
    await expect(
      page
        .getByRole('button', { name: /User menu|Profile/i })
        .or(page.locator('[data-aura-class="forceHeaderButton"]'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('direct contact record url loads when configured', async ({ page }) => {
    test.skip(!CONTACT_RECORD_URL, 'Set CONTACT_RECORD_URL to run this exploratory flow.');

    await login(page);
    await page.goto(CONTACT_RECORD_URL!);
    await expect(page).toHaveURL(/\/Contact\/.+\/view/);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
  });
});
