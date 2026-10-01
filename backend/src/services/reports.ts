// Report service: create / list / get. AI analysis lives in analyze.ts (Phase 2).
import type { Report } from '../shared/types.js';
import type { CreateReportInput } from '../shared/schemas.js';
import { putReport, getReport, listReports, listReportsByStatus, listReportsByCategory } from '../data/repo.js';
import { presignImageUpload, imageUrlForKey } from './uploads.js';
import { newReportId, newUserId, nowIso, sanitizeText, logEvent } from '../shared/util.js';
import type { Category } from '../shared/types.js';

export interface CreateReportResult {
  report: Report;
  upload?: { url: string; key: string };
}

export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  const reportId = newReportId();
  const userId = input.userId?.trim() || newUserId();
  const createdAt = nowIso();

  let upload: { url: string; key: string } | undefined;
  let imageKey: string | undefined;
  let imageUrl: string | undefined;

  if (input.hasImage && input.imageContentType) {
    upload = await presignImageUpload(reportId, input.imageContentType);
    imageKey = upload.key;
    imageUrl = imageUrlForKey(upload.key);
  }

  const report: Report = {
    reportId,
    userId,
    createdAt,
    title: sanitizeText(input.title) || sanitizeText(input.text).slice(0, 60) || 'Untitled report',
    text: sanitizeText(input.text),
    imageKey,
    imageUrl,
    location: input.location,
    category: input.category,
    status: 'NEW',
  };

  await putReport(report);
  logEvent('REPORT_CREATED', { reportId, hasImage: !!imageKey, category: input.category });
  return { report, upload };
}

export async function fetchReport(id: string): Promise<Report | undefined> {
  return getReport(id);
}

export async function fetchReports(opts: {
  status?: string;
  category?: string;
  limit?: number;
}): Promise<Report[]> {
  if (opts.status) return listReportsByStatus(opts.status, opts.limit);
  if (opts.category) return listReportsByCategory(opts.category as Category, opts.limit);
  return listReports(opts.limit);
}
