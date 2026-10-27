import { useEffect, useState } from "react"
import { getAiComparison, requestAiComparison, type AiComparison as Comparison, type Evaluation } from "../../lib/assessments"

const fmt = (value: number | null | undefined) => (value === null || value === undefined ? "—" : Number(value).toFixed(1))

function ScoreColumn({ label, sub, score, tone }: { label: string; sub: string; score: number | null; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className={`text-[11px] font-bold tracking-wider ${tone}`}>{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-kez-dark">
        {fmt(score)}
        <span className="text-sm font-semibold text-slate-400"> / 100</span>
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{sub}</p>
    </div>
  )
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null
  return (
    <div className="rounded-2xl bg-white p-4 text-sm">
      <b className={`text-xs ${tone}`}>{title}</b>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Tutor/admin research aid: the trained model's estimate next to a Gemini
 * estimate of the same quantity (pronunciation accuracy, 0-100). Shown for
 * comparison only; it never changes the learner's score or pre/post results.
 */
export default function AiComparison({ submissionId, evaluation }: { submissionId: string; evaluation: Evaluation }) {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [consented, setConsented] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  useEffect(() => {
    getAiComparison(submissionId)
      .then(setComparison)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [submissionId])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      setComparison(await requestAiComparison(submissionId))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const modelScore = comparison?.model_score ?? evaluation.predicted_score
  const difference =
    comparison?.ai_score !== null && comparison?.ai_score !== undefined ? comparison.ai_score - modelScore : null

  return (
    <div className="rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/60 p-6 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold tracking-wider text-white">
          AI COMPARISON
        </span>
        <span className="text-xs text-violet-700">Research aid for tutors · not shown to the learner · not part of any score</span>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

      {!loading && !comparison && (
        <div className="mt-4 text-sm text-violet-950">
          <p>
            Ask Google Gemini to estimate pronunciation accuracy on this recording, the same measure the trained
            model predicts, and compare the two.
          </p>
          <label className="mt-3 flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 accent-violet-600"
            />
            The learner has agreed that this recording may be sent to Google Gemini for research comparison.
          </label>
          <button
            onClick={run}
            disabled={!consented || busy}
            className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? `Asking Gemini… ${elapsed}s` : "Compare with AI"}
          </button>
          {busy && elapsed >= 15 && (
            <p className="mt-2 text-xs text-violet-800">
              Gemini is busy right now; trying backup models. This can take up to two minutes.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}

      {comparison && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ScoreColumn
              label="TRAINED MODEL"
              sub={comparison.model_version ?? evaluation.model_version}
              score={modelScore}
              tone="text-kez-blue"
            />
            <ScoreColumn label="GEMINI ESTIMATE" sub={`${comparison.provider} ${comparison.model}`} score={comparison.ai_score} tone="text-violet-700" />
            <div className="rounded-2xl bg-white p-4">
              <p className="text-[11px] font-bold tracking-wider text-slate-500">DIFFERENCE</p>
              <p className="mt-2 text-3xl font-extrabold text-kez-dark">
                {difference === null ? "—" : `${difference > 0 ? "+" : ""}${difference.toFixed(1)}`}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Gemini minus model, in points</p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-700">{comparison.summary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <List title="GEMINI: STRENGTHS" items={comparison.strengths} tone="text-green-700" />
            <List title="GEMINI: TO IMPROVE" items={comparison.improvements} tone="text-amber-700" />
          </div>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-bold text-violet-700">Compare transcripts</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <b className="text-xs text-kez-blue">WHISPER (USED BY THE MODEL)</b>
                <p className="mt-2 leading-7 text-slate-600">“{evaluation.transcript}”</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <b className="text-xs text-violet-700">GEMINI</b>
                <p className="mt-2 leading-7 text-slate-600">“{comparison.transcript || "—"}”</p>
              </div>
            </div>
          </details>

          <p className="mt-4 text-[11px] leading-5 text-slate-500">
            Both numbers are experimental machine estimates. Requested {new Date(comparison.created_at).toLocaleString()}.
          </p>
        </>
      )}
    </div>
  )
}
