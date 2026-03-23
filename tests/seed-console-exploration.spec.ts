import { test, expect } from '@playwright/test';

test.use({ headless: false });

const SALESFORCE_LOGIN_URL = 'https://test.salesforce.com/';
const SEED_USER = process.env.SEED_USER || 'msaini@horizontal.jumeirah.qa';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Jumeirah2026@@';

async function login(page: import('@playwright/test').Page) {
  await page.goto(SALESFORCE_LOGIN_URL);
  await page.locator('#username').or(page.getByRole('textbox', { name: 'Username' })).fill(SEED_USER);
  await page.locator('#password').or(page.getByRole('textbox', { name: 'Password' })).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: /Log In to Sandbox|Log In/i }).click();

  // In this org, login can land on home, a console page, or a record page.
  await expect(page).toHaveURL(/lightning|one\/one\.app/, { timeout: 20_000 });
}

async function openNavigationMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Show Navigation Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation Menu' })).toBeVisible({ timeout: 10_000 });
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

test.describe('Seed console exploration', () => {
  test('login lands in Lightning experience', async ({ page }) => {
    await login(page);
    await expect(page).toHaveTitle(/Salesforce|Lightning Experience/);
  });

  test('top Cases navigation opens recently viewed list', async ({ page }) => {
    await login(page);
    await openDestination(page, 'Cases');

    await expect(page).toHaveURL(/\/lightning\/o\/Case\/list/);
    await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('searchbox', { name: 'Search this list...' })).toBeVisible();
  });

  test('navigation menu shows expected console destinations', async ({ page }) => {
    await login(page);
    await openNavigationMenu(page);

    await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Cases' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Contacts' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Approval Requests' })).toBeVisible();
  });

  test('navigation menu opens Contacts recently viewed list', async ({ page }) => {
    await login(page);
    await openDestination(page, 'Contacts');

    await expect(page).toHaveURL(/\/lightning\/o\/Contact\/list/);
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  });

  test('cases list exposes recent records and actions', async ({ page }) => {
    await login(page);
    await openDestination(page, 'Cases');

    await expect(page.getByRole('rowheader').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});
