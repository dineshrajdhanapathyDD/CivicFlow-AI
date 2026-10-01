import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, uploadToPresigned } from '../lib/api.js';
import { CATEGORY_LABELS, type Category } from '../lib/types.js';
import { ErrorState } from '../components/ui.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

interface CreateResp {
  reportId: string;
  status: string;
  upload?: { url: string; key: string };
}

// Persist a lightweight anonymous citizen id so a user can find their reports.
function getUserId(): string {
  let id = localStorage.getItem('cf_user');
  if (!id) {
    id = `USER-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('cf_user', id);
  }
  return id;
}

export default function ReportForm() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [locationLabel, setLocationLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function onPickFile(f: File | null) {
    setFileError('');
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED.includes(f.type)) {
      setFileError('Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError('Image is too large. Maximum size is 8 MB.');
      return;
    }
    setFile(f);
  }

  const canSubmit =
    (title.trim().length > 0 || text.trim().length > 0 || !!file) && !fileError && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!canSubmit) {
      setError('Please add a description or an image before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.post<CreateResp>('/reports', {
        title: title.trim() || undefined,
        text: text.trim() || undefined,
        category: category || undefined,
        location: locationLabel.trim() ? { label: locationLabel.trim() } : undefined,
        userId: getUserId(),
        hasImage: !!file,
        imageContentType: file?.type,
      });

      if (file && created.upload) {
        await uploadToPresigned(created.upload.url, file);
      }

      // Kick off AI analysis, but never block navigation on it.
      api.post(`/reports/${created.reportId}/analyze`).catch(() => undefined);

      nav(`/report/${created.reportId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Report a community issue</h1>
      <p className="mt-2 text-slate-600">
        Describe what you see, add a photo, or both. CivicFlow analyzes the evidence and connects
        it to the underlying problem.
      </p>

      {error && (
        <div className="mt-6">
          <ErrorState message={error} />
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="text-sm font-semibold text-slate-800">
            Short description
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="Streetlight out near the school"
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="text" className="text-sm font-semibold text-slate-800">
            Details
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="The streetlight near the school has not worked for three nights."
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="category" className="text-sm font-semibold text-slate-800">
              Category <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Let AI decide</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="loc" className="text-sm font-semibold text-slate-800">
              Location <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="loc"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              maxLength={200}
              placeholder="5th Ave near Lincoln School"
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="image" className="text-sm font-semibold text-slate-800">
            Photo <span className="font-normal text-slate-400">(optional, max 8 MB)</span>
          </label>
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          {fileError && <p className="text-sm font-medium text-red-600">{fileError}</p>}
          {file && !fileError && (
            <img
              src={URL.createObjectURL(file)}
              alt="Selected evidence preview"
              className="mt-2 max-h-56 w-auto rounded-lg border border-slate-200 object-cover"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition active:translate-y-px hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}
