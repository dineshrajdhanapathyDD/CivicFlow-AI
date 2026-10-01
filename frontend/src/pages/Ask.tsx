import { useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Spinner, ErrorState } from '../components/ui.js';

interface AskResp {
  answer?: string;
  used?: string[];
  pending?: boolean;
}

const SUGGESTIONS = [
  'What are the most common unresolved problems?',
  'Which issues have the highest priority?',
  'How many streetlight reports are active?',
  'What areas have repeated complaints?',
];

export default function Ask() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<AskResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3) return;
    setLoading(true);
    setError('');
    setAnswer(null);
    try {
      const res = await api.post<AskResp>('/ask', { question: text });
      setAnswer(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ask CivicFlow</h1>
      <p className="mt-2 text-slate-600">
        Ask about community issues. A tool-using AI agent retrieves real CivicFlow data
        before answering, so responses are grounded in facts, not guesses.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Which issues have the highest priority?"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={loading || q.trim().length < 3}
          className="rounded-lg bg-teal-600 px-5 py-2 font-semibold text-white transition active:translate-y-px hover:bg-teal-700 disabled:bg-slate-300"
        >
          Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQ(s);
              ask(s);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading && <Spinner label="Consulting community data…" />}
        {error && <ErrorState message={error} />}
        {answer?.pending && (
          <Card className="p-6 text-slate-600">
            Ask CivicFlow arrives with Phase 4. The endpoint is wired and ready.
          </Card>
        )}
        {answer && !answer.pending && answer.answer && (
          <Card className="p-6">
            <p className="whitespace-pre-line text-slate-800">{answer.answer}</p>
            {answer.used && answer.used.length > 0 && (
              <p className="mt-4 text-xs text-slate-400">
                Answered by the CivicFlow agent using tools: {answer.used.join(', ')}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
