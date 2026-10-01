// Single Lambda router for the CivicFlow HTTP API.
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ok, fail, response, logEvent } from './shared/util.js';
import {
  createReportSchema,
  presignSchema,
  listQuerySchema,
} from './shared/schemas.js';
import { createReport, fetchReport, fetchReports } from './services/reports.js';
import { presignImageUpload } from './services/uploads.js';
import { analyzeReport } from './services/analyze.js';
import { getIssueWithReports } from './services/clustering.js';
import { listIssues, updateIssueStatus } from './data/repo.js';
import { updateIssueStatusSchema, askSchema } from './shared/schemas.js';
import { config } from './shared/config.js';
import { nowIso } from './shared/util.js';
import { computeDashboardStats } from './services/dashboard.js';
import { askCivicFlow } from './services/ask.js';

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

export const handler: Handler = async (event) => {
  const method = event.requestContext.http.method;
  const rawPath = event.rawPath || '/';
  // Normalize any stage prefix; routes are matched on the trailing path.
  const path = rawPath.replace(/\/$/, '') || '/';

  if (method === 'OPTIONS') return response(204, { ok: true });

  try {
    // ---- reports ----
    if (method === 'POST' && path === '/reports') return await handleCreateReport(event);
    if (method === 'GET' && path === '/reports') return await handleListReports(event);

    const reportIdMatch = path.match(/^\/reports\/([^/]+)$/);
    if (method === 'GET' && reportIdMatch)
      return await handleGetReport(decodeURIComponent(reportIdMatch[1]));

    const analyzeMatch = path.match(/^\/reports\/([^/]+)\/analyze$/);
    if (method === 'POST' && analyzeMatch)
      return await handleAnalyze(decodeURIComponent(analyzeMatch[1]));

    // ---- uploads ----
    if (method === 'POST' && path === '/uploads/presign')
      return await handlePresign(event);

    // ---- issues ----
    if (method === 'GET' && path === '/issues') return await handleListIssues(event);

    const issueStatusMatch = path.match(/^\/issues\/([^/]+)\/status$/);
    if (method === 'PATCH' && issueStatusMatch)
      return await handleUpdateIssueStatus(decodeURIComponent(issueStatusMatch[1]), event);

    const issueIdMatch = path.match(/^\/issues\/([^/]+)$/);
    if (method === 'GET' && issueIdMatch)
      return await handleGetIssue(decodeURIComponent(issueIdMatch[1]));

    // ---- dashboard / ask ----
    if (method === 'GET' && path === '/dashboard/stats') return await handleDashboard();
    if (method === 'POST' && path === '/ask') return await handleAsk(event);

    if (method === 'GET' && path === '/health') return ok({ status: 'up' });

    return fail(404, 'Not found');
  } catch (err) {
    // Never leak internal AWS errors to users.
    logEvent('UNHANDLED_ERROR', { message: (err as Error).message, path, method });
    return fail(500, 'Something went wrong. Please try again.');
  }
};

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
}

async function handleCreateReport(event: APIGatewayProxyEventV2) {
  const parsed = createReportSchema.safeParse(parseBody(event));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || 'Invalid input');
  const result = await createReport(parsed.data);
  return ok(
    { reportId: result.report.reportId, status: result.report.status, upload: result.upload },
    201,
  );
}

async function handleListReports(event: APIGatewayProxyEventV2) {
  const q = listQuerySchema.safeParse(event.queryStringParameters || {});
  if (!q.success) return fail(400, 'Invalid query');
  const items = await fetchReports({
    status: q.data.status,
    category: q.data.category,
    limit: q.data.limit,
  });
  return ok({ items });
}

async function handleGetReport(id: string) {
  const report = await fetchReport(id);
  if (!report) return fail(404, 'Report not found');
  return ok(report);
}

async function handlePresign(event: APIGatewayProxyEventV2) {
  const parsed = presignSchema.safeParse(parseBody(event));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || 'Invalid input');
  const res = await presignImageUpload(parsed.data.reportId, parsed.data.contentType);
  return ok(res);
}

async function handleAnalyze(id: string) {
  const result = await analyzeReport(id);
  if (!result) return fail(404, 'Report not found');
  return ok({
    report: result.report,
    issue: result.issue,
    similar: result.similar || [],
  });
}

async function handleListIssues(event: APIGatewayProxyEventV2) {
  const q = listQuerySchema.safeParse(event.queryStringParameters || {});
  const limit = q.success ? q.data.limit : 50;
  let items = await listIssues(limit);
  const status = q.success ? q.data.status : undefined;
  const category = q.success ? q.data.category : undefined;
  const priority = q.success ? q.data.priority : undefined;
  if (status) items = items.filter((i) => i.status === status);
  if (category) items = items.filter((i) => i.category === category);
  if (priority) items = items.filter((i) => i.priority === priority);
  return ok({ items });
}

async function handleGetIssue(id: string) {
  const result = await getIssueWithReports(id);
  if (!result) return fail(404, 'Issue not found');
  return ok(result);
}

async function handleUpdateIssueStatus(id: string, event: APIGatewayProxyEventV2) {
  // Admin-gated action.
  const key = event.headers?.['x-admin-key'] || event.headers?.['X-Admin-Key'];
  if (!config.adminKey || key !== config.adminKey) {
    return fail(401, 'Not authorized');
  }
  const parsed = updateIssueStatusSchema.safeParse(parseBody(event));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || 'Invalid status');
  const updated = await updateIssueStatus(id, parsed.data.status, nowIso());
  if (!updated) return fail(404, 'Issue not found');
  logEvent('ISSUE_STATUS_CHANGED', { issueId: id, status: parsed.data.status });
  return ok(updated);
}

async function handleDashboard() {
  const stats = await computeDashboardStats();
  return ok(stats);
}

async function handleAsk(event: APIGatewayProxyEventV2) {
  const parsed = askSchema.safeParse(parseBody(event));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || 'Invalid question');
  const result = await askCivicFlow(parsed.data.question);
  return ok(result);
}
