import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    await page.goto('https://test.salesforce.com/');
    await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill('msaini@horizontal.jumeirah.qa');
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('Jumeirah2026@@');
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
    // await page.goto('https://jumeirahinternational2--qa.sandbox.lightning.force.com/lightning/r/Contact/003WL00000cC4d3YAC/view');
  });
});
