// Thin API client. Base URL comes from build-time env; no AWS creds ever here.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new Error('The server returned an unexpected response.');
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Request failed. Please try again.');
  }
  return json.data as T;
}

export const api = {
  get: <T>(p: string) => req<T>('GET', p),
  post: <T>(p: string, body?: unknown, headers?: Record<string, string>) =>
    req<T>('POST', p, body, headers),
  patch: <T>(p: string, body?: unknown, headers?: Record<string, string>) =>
    req<T>('PATCH', p, body, headers),
  base: BASE,
};

/** Upload a file to a presigned S3 PUT URL. */
export async function uploadToPresigned(
  url: string,
  file: File,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Image upload failed. Please try again.');
}
