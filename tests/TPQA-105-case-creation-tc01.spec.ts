/**
 * TPQA-105: Test Case – Create a new guest-related case with all mandatory fields (TC-01)
 * Jira: https://horizontal.atlassian.net/browse/TPQA-105
 *
 * Steps: Navigate to Cases → Enter Subject, Type, Case Category, Case Sub Category,
 * Related Hotel, Classification, Case Origin → Save → Verify toast notification and URL persistence.
 *
 * Linked to user story: TPQA-104
 * Flow integrated from codegen (working locators).
 *
 * Env: SALESFORCE_BASE_URL, INITIATOR_USER, INITIATOR_PASSWORD
 */

import { test, expect } from '@playwright/test';

test.use({ headless: false });

const SALESFORCE_BASE =
  process.env.SALESFORCE_BASE_URL || 'https://jumeirahinternational2--qa.sandbox.my.salesforce.com/';
const INITIATOR_USER = process.env.INITIATOR_USER || 'msaini@horizontal.jumeirah.qa';
const INITIATOR_PASSWORD = process.env.INITIATOR_PASSWORD || 'Jumeirah2026@@';

// Field values from codegen (working flow)
const CASE_SUBJECT = 'test automation subject';
const STATUS = 'New';
const PRIORITY = 'Medium';
const CASE_ORIGIN = 'Phone';
const CASE_TYPE = 'Jumeirah One';
const RELATED_HOTEL = 'Jumeirah Al Naseem';
const CASE_CATEGORY = 'Membership';
const CLASSIFICATION = 'External';
const CASE_SUB_CATEGORY = 'Feedback';

test.describe('TPQA-105: Create guest-related case with mandatory fields (TC-01)', () => {
  test('Create case, save, verify toast and URL persistence', async ({ page }) => {
    test.slow();
    page.setDefaultTimeout(20_000);

    await test.step('Login to Salesforce Sandbox', async () => {
      await page.goto(SALESFORCE_BASE);
      await page.locator("//input[@id='username']").fill(INITIATOR_USER);
      await page.locator("//input[@id='password']").fill(INITIATOR_PASSWORD);
      await page.locator("//input[@id='Login']").click();
    });

    await test.step('Navigate to Cases via App Launcher', async () => {
      await page.getByRole('button', { name: 'App Launcher' }).click();
      await page.getByRole('combobox', { name: 'Search apps and items...' }).click();
      await page.getByRole('combobox', { name: 'Search apps and items...' }).fill('cases');
      await page.getByRole('link', { name: 'Cases' }).first().click();
    });

    await test.step('Create new case with mandatory fields', async () => {
      await page.locator('//div[@title="New"]').click();
      await page.waitForSelector('//span[normalize-space()="Standard Case"]', { timeout: 10_000 });
      await page.locator('//span[normalize-space()="Standard Case"]').click();
      await page.locator('//span[normalize-space()="Next"]').click();
      await page.waitForSelector('//input[@name="Subject"]', { timeout: 10_000 });

      const subjectInput = page.locator('//input[@name="Subject"]');
      await subjectInput.click();
      await subjectInput.fill(CASE_SUBJECT);

      const statusCombo = page.locator('//button[@aria-label="Status"]');
      await statusCombo.click();
      await page.getByRole('option', { name: '⭐️ New' }).click();

      const priorityCombo = page.getByRole('combobox', { name: 'Priority' });
      await priorityCombo.click();
      await page.getByRole('option', { name: PRIORITY }).first().click();

      const originCombo = page.getByRole('combobox', { name: 'Case Origin' });
      await originCombo.click();
      await page.getByRole('option', { name: CASE_ORIGIN }).first().click();

      const typeCombo = page.getByRole('combobox', { name: 'Type', exact: true });
      await typeCombo.click();
      await page.getByRole('option', { name: CASE_TYPE }).first().click();

      const hotelCombo = page.getByRole('combobox', { name: 'Related Hotel' });
      await hotelCombo.click();
      await page.getByRole('option', { name: RELATED_HOTEL }).first().click();

      const categoryCombo = page.getByRole('combobox', { name: 'Case Category' });
      await categoryCombo.click();
      await page.getByRole('option', { name: CASE_CATEGORY }).first().click();

      const classificationCombo = page.getByRole('combobox', { name: 'Classification' });
      await classificationCombo.click();
      await page.getByRole('option', { name: CLASSIFICATION }).first().click();

      const subCategoryCombo = page.getByRole('combobox', { name: 'Case Sub Category' });
      await subCategoryCombo.click();
      await page.getByRole('option', { name: CASE_SUB_CATEGORY }).first().click();

      await page.getByRole('button', { name: 'Save', exact: true }).click();
    });

    await test.step('Verify toast notification', async () => {
      await expect(page.getByRole('alert').or(page.locator('[role="status"]'))).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('alert').or(page.locator('[role="status"]'))).toContainText(/\d{5,}/);
    });

    await test.step('Verify URL persistence', async () => {
      const url = page.url();
      expect(url).toMatch(/\/Case\/[a-zA-Z0-9]+/);
    });
  });
});
