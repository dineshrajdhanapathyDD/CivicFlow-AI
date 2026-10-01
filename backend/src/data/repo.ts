// DynamoDB single-table access layer for CivicFlow.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../shared/config.js';
import type { Report, Issue, Category } from '../shared/types.js';

const client = new DynamoDBClient({ region: config.region });
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const T = config.tableName;

// ---------- key helpers ----------
const reportPk = (id: string) => `REPORT#${id}`;
const issuePk = (id: string) => `ISSUE#${id}`;

// ---------- Reports ----------
export async function putReport(report: Report): Promise<Report> {
  await doc.send(
    new PutCommand({
      TableName: T,
      Item: {
        PK: reportPk(report.reportId),
        SK: reportPk(report.reportId),
        GSI1PK: 'TYPE#REPORT',
        GSI1SK: report.createdAt,
        GSI2PK: report.category ? `CAT#${report.category}` : 'CAT#unknown',
        GSI2SK: report.createdAt,
        GSI3PK: `STATUS#${report.status}`,
        GSI3SK: report.createdAt,
        entity: 'REPORT',
        ...report,
      },
    }),
  );
  return report;
}

export async function getReport(id: string): Promise<Report | undefined> {
  const res = await doc.send(
    new GetCommand({ TableName: T, Key: { PK: reportPk(id), SK: reportPk(id) } }),
  );
  return res.Item ? stripKeys<Report>(res.Item) : undefined;
}

export async function updateReport(
  id: string,
  patch: Partial<Report>,
): Promise<Report | undefined> {
  const current = await getReport(id);
  if (!current) return undefined;
  const next: Report = { ...current, ...patch };
  await putReport(next); // overwrite keeps GSI keys in sync with new status/category
  return next;
}

export async function listReports(limit = 20): Promise<Report[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: T,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'TYPE#REPORT' },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items || []).map((i) => stripKeys<Report>(i));
}

export async function listReportsByStatus(status: string, limit = 50): Promise<Report[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: T,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: { ':pk': `STATUS#${status}` },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items || []).map((i) => stripKeys<Report>(i));
}

export async function listReportsByCategory(
  category: Category,
  limit = 50,
): Promise<Report[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: T,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `CAT#${category}` },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items || []).map((i) => stripKeys<Report>(i));
}

// ---------- Issues ----------
export async function putIssue(issue: Issue): Promise<Issue> {
  await doc.send(
    new PutCommand({
      TableName: T,
      Item: {
        PK: issuePk(issue.issueId),
        SK: issuePk(issue.issueId),
        GSI1PK: 'TYPE#ISSUE',
        GSI1SK: issue.updatedAt,
        GSI2PK: `CAT#${issue.category}`,
        GSI2SK: issue.updatedAt,
        GSI3PK: `STATUS#${issue.status}`,
        GSI3SK: issue.updatedAt,
        entity: 'ISSUE',
        ...issue,
      },
    }),
  );
  return issue;
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  const res = await doc.send(
    new GetCommand({ TableName: T, Key: { PK: issuePk(id), SK: issuePk(id) } }),
  );
  return res.Item ? stripKeys<Issue>(res.Item) : undefined;
}

export async function listIssues(limit = 50): Promise<Issue[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: T,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'TYPE#ISSUE' },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items || []).map((i) => stripKeys<Issue>(i));
}

export async function updateIssueStatus(
  id: string,
  status: string,
  updatedAt: string,
): Promise<Issue | undefined> {
  const current = await getIssue(id);
  if (!current) return undefined;
  const next: Issue = { ...current, status: status as Issue['status'], updatedAt };
  await putIssue(next);
  return next;
}

// ---------- Issue <-> Report membership links ----------
// Link item: PK = ISSUE#<issueId>, SK = REPORT#<reportId>
export async function linkReportToIssue(
  issueId: string,
  reportId: string,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: T,
      Item: {
        PK: issuePk(issueId),
        SK: reportPk(reportId),
        entity: 'LINK',
        issueId,
        reportId,
      },
    }),
  );
}

/** Return the reportIds linked to an issue (excludes the issue item itself). */
export async function listIssueReportIds(issueId: string): Promise<string[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: T,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': issuePk(issueId), ':sk': 'REPORT#' },
    }),
  );
  return (res.Items || []).map((i) => (i.reportId as string) || '');
}

// Remove internal key attributes before returning domain objects.
function stripKeys<T>(item: Record<string, unknown>): T {
  const {
    PK,
    SK,
    GSI1PK,
    GSI1SK,
    GSI2PK,
    GSI2SK,
    GSI3PK,
    GSI3SK,
    entity,
    ...rest
  } = item as Record<string, unknown>;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void GSI2PK;
  void GSI2SK;
  void GSI3PK;
  void GSI3SK;
  void entity;
  return rest as T;
}
