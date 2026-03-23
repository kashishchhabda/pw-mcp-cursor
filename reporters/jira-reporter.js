/**
 * Jira Reporter – posts test results as comments and updates issue status.
 * Mapping: jira-tests.json | Env: JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
 */

const path = require('path');
const fs = require('fs');

const JIRA_KEY_PATTERN = /([A-Z]{2,10}-\d+)/gi;

function loadJiraConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'jira-tests.json');
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function getJiraKeysForFile(filePath, config) {
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  const basename = path.basename(filePath);

  if (config) {
    for (const [pattern, key] of Object.entries(config)) {
      if (key === null) continue;
      const normPattern = path.normalize(pattern).replace(/\\/g, '/');
      if (normalized.endsWith(normPattern) || normalized.includes(normPattern) || basename === path.basename(pattern)) {
        return [key.toUpperCase()];
      }
    }
  }

  const matches = [...basename.matchAll(JIRA_KEY_PATTERN)].map((m) => m[1].toUpperCase());
  return [...new Set(matches)];
}

function loadEnv() {
  try {
    require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
  } catch {}
}

function textToAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: text.split('\n').filter(Boolean).map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })),
  };
}

function authHeader(username, apiToken) {
  return 'Basic ' + Buffer.from(`${username}:${apiToken}`).toString('base64');
}

async function postComment(baseUrl, username, apiToken, issueKey, body) {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}/comment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader(username, apiToken) },
    body: JSON.stringify({ body: textToAdf(body) }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 404) {
      throw new Error(
        `404: Issue ${issueKey} not found or no permission. ` +
          `Verify (1) the issue exists at ${baseUrl}browse/${issueKey} ` +
          `(2) JIRA_USERNAME has access to the project. Raw: ${errBody}`
      );
    }
    throw new Error(`Jira comment ${res.status}: ${errBody}`);
  }
}

async function getTransitions(baseUrl, username, apiToken, issueKey) {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}/transitions`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: authHeader(username, apiToken) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.transitions || [];
}

async function transitionIssue(baseUrl, username, apiToken, issueKey, transitionId) {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}/transitions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader(username, apiToken) },
    body: JSON.stringify({ transition: { id: String(transitionId) } }),
  });
  if (!res.ok) throw new Error(`Jira transition ${res.status}: ${await res.text()}`);
}

async function transitionToStatus(baseUrl, username, apiToken, issueKey, statusName) {
  const transitions = await getTransitions(baseUrl, username, apiToken, issueKey);
  const t = transitions.find((x) => x.name && x.name.toLowerCase() === statusName.toLowerCase());
  if (t) await transitionIssue(baseUrl, username, apiToken, issueKey, t.id);
}

function buildComment(summary) {
  const status = summary.failed === 0 ? 'PASSED' : 'FAILED';
  const lines = [
    '*Playwright Test Run*',
    `Status: ${status}`,
    `File: ${summary.file}`,
    `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Skipped: ${summary.skipped}`,
    `Duration: ${(summary.duration / 1000).toFixed(2)}s`,
  ];
  if (summary.failedTests.length > 0) lines.push(`Failed: ${summary.failedTests.join(', ')}`);
  return lines.join('\n');
}

class JiraReporter {
  constructor() {
    this.summariesByKey = new Map();
    this.jiraConfig = null;
  }

  onBegin() {
    this.summariesByKey.clear();
    this.jiraConfig = loadJiraConfig();
  }

  onTestEnd(test, result) {
    const file = test.location.file;
    const keys = getJiraKeysForFile(file, this.jiraConfig);
    for (const key of keys) {
      let s = this.summariesByKey.get(key);
      if (!s) {
        s = { issueKey: key, file, total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, failedTests: [] };
        this.summariesByKey.set(key, s);
      }
      s.total++;
      s.duration += result.duration;
      if (result.status === 'passed') s.passed++;
      else if (result.status === 'failed') {
        s.failed++;
        s.failedTests.push(test.title);
      } else s.skipped++;
    }
  }

  async onEnd() {
    loadEnv();
    const baseUrl = process.env.JIRA_URL;
    const username = process.env.JIRA_USERNAME;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!baseUrl || !username || !apiToken) {
      console.log('\n[JiraReporter] JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN not set – skipping');
      return;
    }

    for (const summary of this.summariesByKey.values()) {
      try {
        const body = buildComment(summary);
        await postComment(baseUrl, username, apiToken, summary.issueKey, body);
        console.log(`[JiraReporter] Posted comment to ${summary.issueKey}`);

        if (summary.failed === 0) {
          await transitionToStatus(baseUrl, username, apiToken, summary.issueKey, 'PASSED');
          console.log(`[JiraReporter] Status updated to PASSED for ${summary.issueKey}`);
        } else {
          await transitionToStatus(baseUrl, username, apiToken, summary.issueKey, 'FAILED');
          console.log(`[JiraReporter] Status updated to FAILED for ${summary.issueKey}`);
        }
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        console.error(`[JiraReporter] ${summary.issueKey}: ${msg}`);
        if (msg.includes('404')) {
          console.log(`[JiraReporter] Tip: Verify ${baseUrl}browse/${summary.issueKey} exists and JIRA_USERNAME has access.`);
        }
      }
    }
  }
}

module.exports = JiraReporter;
