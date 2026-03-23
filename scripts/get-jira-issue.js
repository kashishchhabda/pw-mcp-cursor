/**
 * Fetches a Jira issue by key. Uses env: JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
 * Usage: node get-jira-issue.js <issue-key>
 */
const issueKey = process.argv[2] || 'HIQA-141';
const baseUrl = (process.env.JIRA_URL || '').replace(/\/$/, '');
const username = process.env.JIRA_USERNAME;
const token = process.env.JIRA_API_TOKEN;

if (!baseUrl || !username || !token) {
  console.error('Set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN');
  process.exit(1);
}

const auth = Buffer.from(`${username}:${token}`).toString('base64');
const url = `${baseUrl}/rest/api/3/issue/${issueKey}?fields=summary,status,assignee,description,created,updated,reporter,priority,issuetype`;

fetch(url, {
  headers: {
    Accept: 'application/json',
    Authorization: `Basic ${auth}`,
  },
})
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return r.json();
  })
  .then((data) => {
    const f = data.fields || {};
    console.log(JSON.stringify({
      key: data.key,
      summary: f.summary,
      status: f.status?.name,
      assignee: f.assignee?.displayName,
      reporter: f.reporter?.displayName,
      priority: f.priority?.name,
      issuetype: f.issuetype?.name,
      created: f.created,
      updated: f.updated,
      description: f.description ? (typeof f.description === 'string' ? f.description : (f.description.content || []).map(c => c.content?.map(t => t.text).join('')).join('\n')) : undefined,
    }, null, 2));
  })
  .catch((err) => {
    console.error('Error:', err.message);
    if (err.cause) console.error('Cause:', err.cause.message || err.cause);
    process.exit(1);
  });
