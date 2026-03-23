/**
 * HIQA-163: Case Management - Creation, Approval Submission & Approval Workflow (Salesforce CRM)
 *
 * Covers the end-to-end case management workflow:
 * - Case creation with mandatory fields
 * - Submit for approval with comments and approver selection
 * - Approver opens case via URL and approves from History Items
 *
 * Acceptance criteria (from Jira):
 * - Case is saved with all mandatory fields and a case number is generated.
 * - Toast notification appears immediately after save with the case number.
 * - Case URL is stable and accessible across user sessions.
 * - Approval dialog accepts comments and shows an approver search field.
 * - Approver can be found by partial name and confirmed.
 * - Approver can open the case directly via URL without additional search.
 * - History Items tab shows the pending approval with an actionable Approve button.
 * - Approval comment is saved against the case history.
 * - Case status reflects Approved after the workflow completes.
 *
 * Configure via env: SALESFORCE_BASE_URL, INITIATOR_USER, INITIATOR_PASSWORD, APPROVER_USER, APPROVER_PASSWORD
 *
 * Debugging locators:
 * - This spec runs in headed mode by default.
 * - To step through: npx playwright test tests/HIQA-163-case-management-approval.spec.ts --debug
 * - To pause at a step: add await page.pause(); in that step, then run normally.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Always run this spec in headed mode for debugging locators
test.use({ headless: false });

const SALESFORCE_BASE = process.env.SALESFORCE_BASE_URL || 'https://test.salesforce.com';
const INITIATOR_USER = process.env.INITIATOR_USER || 'qa.manager@example.com';
const INITIATOR_PASSWORD = process.env.INITIATOR_PASSWORD || '';
const APPROVER_USER = process.env.APPROVER_USER || 'qa.assistant.manager@example.com';
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD || '';

// Mandatory case field values per BR-01
const CASE_SUBJECT = 'Test Flow';
const CASE_TYPE = 'Stay';
const CASE_CATEGORY = 'Hotel Complaints';
const CASE_SUB_CATEGORY = 'Not Applicable';
const RELATED_HOTEL = 'Jumeirah Al Naseem';
const CLASSIFICATION = 'External';
const CASE_ORIGIN = 'Phone';

const SUBMISSION_COMMENT = 'Please approve this test case.';
const APPROVER_SEARCH_PARTIAL_NAME = 'QA Assistant'; // partial name search per AC
const APPROVAL_COMMENT = 'Approved for testing.';

/** Stable locators for Salesforce login page (test.salesforce.com uses #username, #password) */
function salesforceLoginLocators(page: Page) {
  return {
    username: page.locator('#username').or(page.getByLabel('Username')),
    password: page.locator('#password').or(page.getByLabel('Password')),
    loginButton: page.getByRole('button', { name: /Log In to Sandbox|Log In/i }),
  };
}

async function chooseRecordTypeIfNeeded(page: Page, recordTypeName = 'Standard Case') {
  const nextButton = page.getByRole('button', { name: 'Next' });
  if (!(await nextButton.isVisible().catch(() => false))) return;

  const recordType = page.getByRole('radio', { name: new RegExp(recordTypeName, 'i') });
  if (await recordType.isVisible().catch(() => false)) {
    await recordType.check();
  }
  await nextButton.click();
}

async function pickComboboxOption(page: Page, fieldName: string, optionText: string) {
  await page.getByRole('combobox', { name: new RegExp(fieldName, 'i') }).click();
  await page.getByRole('option', { name: new RegExp(optionText, 'i') }).click();
}

async function fillTextboxField(page: Page, fieldName: string, value: string) {
  const candidates = [
    page.getByRole('textbox', { name: new RegExp(`^${fieldName}$`, 'i') }).first(),
    page.getByRole('textbox', { name: new RegExp(fieldName, 'i') }).first(),
    page.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`).first(),
    page
      .locator(
        `xpath=//*[normalize-space()="${fieldName}" or normalize-space()="*${fieldName}"]/following::*[self::input or self::textarea][1]`
      )
      .first(),
    page
      .locator(
        `xpath=//*[contains(normalize-space(), "${fieldName}")]/following::*[self::input or self::textarea][1]`
      )
      .first(),
  ];

  for (const candidate of candidates) {
    const visible = await candidate
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await candidate.fill(value);
      return;
    }
  }

  throw new Error(`Unable to find textbox for field: ${fieldName}`);
}

async function logoutFromSalesforce(page: Page) {
  const directLogout = page.getByRole('link', { name: /Log out|Logout/i });
  if (await directLogout.isVisible().catch(() => false)) {
    await directLogout.click();
    return;
  }

  const profileButton = page.getByRole('button', { name: /User menu|Profile|View profile/i });
  await profileButton.click();
  await page.getByRole('link', { name: /Log out|Logout/i }).click();
}

async function submitCaseForApproval(page: Page, approverSearch: string, comment: string) {
  await page.getByRole('button', { name: /Submit for Approval/i }).click();

  await expect(page.getByRole('dialog', { name: 'Submit for Approval' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Comments' }).fill(comment);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Submit for Approval' })).toBeVisible();
  await page.getByRole('combobox', { name: /Choose Next Approver/i }).fill(approverSearch);
  await page.getByRole('option', { name: new RegExp(approverSearch, 'i') }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
}

async function openApprovalWorkitem(page: Page) {
  const workitemTab = page.getByRole('tab', { name: /ProcessInstanceWorkitem.*Approval/i });
  await workitemTab.click();
  await expect(
    page.getByRole('heading', { name: /Approval Request.*Pending/i }).or(
      page.getByRole('heading', { name: /Approval Request/i })
    )
  ).toBeVisible({ timeout: 15_000 });
}

async function approvePendingRequest(page: Page, comment: string) {
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Approve Case/i })).toBeVisible();
  await page.getByRole('textbox', { name: 'Comments' }).fill(comment);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
}

async function openNavigationMenu(page: Page) {
  await page.getByRole('button', { name: 'Show Navigation Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation Menu' })).toBeVisible({
    timeout: 10_000,
  });
}

async function openDestination(page: Page, destination: 'Cases') {
  const topLink = page.getByRole('link', { name: destination, exact: true });
  if (await topLink.isVisible().catch(() => false)) {
    await topLink.click();
    return;
  }

  await openNavigationMenu(page);
  await page.getByRole('menuitem', { name: destination, exact: true }).click();
}

test.describe('HIQA-163: Case Management Approval Workflow', () => {
  test('E2E: Initiator creates case, submits for approval; Approver opens via URL and approves', async ({
    page,
  }) => {
    test.setTimeout(120_000); // NFR: full workflow within 120 seconds
    // Slower default for Lightning; increase if selectors time out
    page.setDefaultTimeout(20_000);
    // Uncomment to pause at a step and inspect: await page.pause();
    let caseRecordUrl: string;
    let caseNumber: string;

    // --- Phase 1: Initiator (QA Manager) ---
    await test.step('Initiator logs in to Salesforce Sandbox', async () => {
      await page.goto('https://test.salesforce.com/');
      const login = salesforceLoginLocators(page);
      await login.username.fill('qamanager@jumeirah.com');
      await login.password.fill('jumqm2026');
      await login.loginButton.click();
      await expect(page).toHaveURL(/\/(lightning|home)/, { timeout: 15000 });
    });

    await test.step('Navigate to Cases via App Launcher', async () => {
      await openDestination(page, 'Cases');
      await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible({ timeout: 15000 });
    });

    await test.step('Create new case with all mandatory fields and save', async () => {
      await page.getByRole('button', { name: /New|New Case/i }).click();
      await chooseRecordTypeIfNeeded(page);

      await fillTextboxField(page, 'Subject', CASE_SUBJECT);
      await pickComboboxOption(page, 'Type', CASE_TYPE);
      await pickComboboxOption(page, 'Case Category', CASE_CATEGORY);
      await pickComboboxOption(page, 'Case Sub Category', CASE_SUB_CATEGORY);
      await pickComboboxOption(page, 'Classification', CLASSIFICATION);
      await pickComboboxOption(page, 'Case Origin', CASE_ORIGIN);
      await pickComboboxOption(page, 'Related Hotel', RELATED_HOTEL);

      await page.getByRole('button', { name: /Save/i }).click();
    });

    await test.step('AC: Case is saved with case number; toast shows case number', async () => {
      await expect(page.getByRole('alert').or(page.locator('[role="status"]'))).toContainText(/\d{5,}/);
      caseNumber = await page.locator('text=/Case Number|\\d{5,}/').first().textContent() ?? '';
      expect(caseNumber).toBeTruthy();
    });

    await test.step('AC: Case URL is stable and stored for approver', async () => {
      caseRecordUrl = page.url();
      expect(caseRecordUrl).toMatch(/\/Case\/[a-zA-Z0-9]+/);
    });

    await test.step('Submit for approval with comment and select approver', async () => {
      await submitCaseForApproval(page, APPROVER_SEARCH_PARTIAL_NAME, SUBMISSION_COMMENT);
    });

    await test.step('Initiator logs out', async () => {
      await logoutFromSalesforce(page);
      await expect(page).toHaveURL(new RegExp(SALESFORCE_BASE));
    });

    // --- Phase 2: Approver (QA Assistant Manager) ---
    await test.step('Approver logs in', async () => {
      await page.goto(SALESFORCE_BASE);
      const login = salesforceLoginLocators(page);
      await login.username.fill('qaassistmanager@jumeirah.com');
      await login.password.fill('Jumeirah@2026');
      await login.loginButton.click();
      await expect(page).toHaveURL(/\/(lightning|home)/, { timeout: 15000 });
    });

    await test.step('AC: Approver opens case directly via URL', async () => {
      await page.goto(caseRecordUrl);
      await expect(page).toHaveURL(new RegExp(caseRecordUrl));
      await expect(page.getByText(caseNumber).or(page.getByText(CASE_SUBJECT))).toBeVisible();
    });

    await test.step('AC: Approval workspace exposes pending approval actions', async () => {
      await openApprovalWorkitem(page);
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    });

    await test.step('Approver clicks Approve, enters comment and confirms', async () => {
      await approvePendingRequest(page, APPROVAL_COMMENT);
    });

    await test.step('AC: Approval comment saved; case status reflects Approved', async () => {
      await expect(page.getByText(APPROVAL_COMMENT)).toBeVisible();
      await expect(page.getByRole('heading', { name: /Process Instance Step.*Approved/i })).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
