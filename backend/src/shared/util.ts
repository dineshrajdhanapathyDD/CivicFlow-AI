// Small deterministic helpers: ids, sanitization, http envelope, logging.
import type { ApiEnvelope } from './types.js';

let counter = Math.floor(Math.random() * 1000);
function shortId(): string {
  counter = (counter + 1) % 100000;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${Date.now().toString(36)}${rand}${counter.toString(36)}`;
}

export function newReportId(): string {
  // Human-friendly demo id like CF-1042 with a uniqueness suffix.
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `CF-${n}-${shortId().slice(-4)}`;
}

export function newIssueId(): string {
  const n = 1 + Math.floor(Math.random() * 900);
  return `CF-ISSUE-${String(n).padStart(3, '0')}-${shortId().slice(-4)}`;
}

export function newUserId(): string {
  return `USER-${shortId()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Strip HTML tags and control chars to neutralize stored-XSS from user content. */
export function sanitizeText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim();
}

export function ok<T>(data: T, statusCode = 200) {
  return response(statusCode, { ok: true, data });
}

export function fail(statusCode: number, error: string) {
  return response(statusCode, { ok: false, error });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-admin-key',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Content-Type': 'application/json',
};

export function response<T>(statusCode: number, body: ApiEnvelope<T>) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/** Structured CloudWatch log line. Never include raw secrets. */
export function logEvent(event: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ts: nowIso(), ...detail }));
}

/** Haversine distance in meters between two coordinates. */
export function haversineMeters(
  a: { lat?: number; lng?: number },
  b: { lat?: number; lng?: number },
): number | undefined {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return undefined;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
