import { useState } from "react"
import {
  isStalled,
  requestAiFeedback,
  requestProcessing,
  retryProcessing,
  statusLabels,
  type Submission,
} from "../lib/assessments"
import AiFeedbackCard from "./AiFeedbackCard"

const STEPS = ["pending", "processing", "transcribing", "extracting_features", "evaluating", "completed"] as const

function AiFallback({ submission, onDone }: { submission: Submission; onDone: () => void }) {
  const [consented, setConsented] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = async () => {
    setBusy(true)
    setError(null)
    try {
      await requestAiFeedback(submission.id)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm text-violet-950">
      <p className="font-bold">Don’t want to wait? Get AI feedback instead</p>
      <p className="mt-1 text-xs leading-5">
        Google Gemini can listen to your recording and give you written tips. It won’t give a score, and it won’t
        count toward your assessment.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 accent-violet-600"
        />
        I agree to send this recording to Google Gemini for feedback.
      </label>
      <button
        onClick={request}
        disabled={!consented || busy}
        className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "Asking Gemini… (up to a minute)" : "Get AI feedback"}
      </button>
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  )
}

/**
 * Shows where a submission is in the pipeline, with retry when it failed or
 * never started, and the Gemini fallback when the model can't score it.
 */
export default function ProcessingStatus({
  submission,
  startError,
  onRetried,
}: {
  submission: Submission
  startError?: string | null
  onRetried: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const current = STEPS.indexOf(submission.status as (typeof STEPS)[number])
  const failed = submission.status === "failed"
  const stuck = (submission.status === "pending" && !!startError) || isStalled(submission)

  const retry = async () => {
    setBusy(true)
    setRetryError(null)
    try {
      await (failed ? retryProcessing(submission.id) : requestProcessing(submission.id))
      onRetried()
    } catch (err) {
      setRetryError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-6 text-left shadow-sm">
        <p className="text-xs font-bold tracking-wider text-kez-blue">ANALYZING YOUR RECORDING</p>
        <ol className="mt-4 space-y-2">
          {STEPS.slice(1, -1).map((step, i) => {
            const index = i + 1
            const done = !failed && current > index
            const active = !failed && !stuck && current === index
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-green-500 text-white" : active ? "animate-pulse bg-kez-blue text-white" : "bg-slate-100 text-slate-400"
                    }`}
                >
                  {done ? "✓" : index}
                </span>
                <span className={active ? "font-bold text-kez-dark" : "text-slate-500"}>{statusLabels[step]}</span>
              </li>
            )
          })}
        </ol>
        {!failed && !stuck && (
          <p className="mt-4 text-xs text-slate-400">This usually takes under a minute. You can leave this page.</p>
        )}
        {(failed || stuck) && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">
              {failed ? "We couldn't analyze this recording." : "The scoring service isn't responding right now."}
            </p>
            <p className="mt-1">{retryError ?? submission.error ?? startError}</p>
            <p className="mt-1 text-xs text-red-700">Your recording is saved, so you don't need to record again.</p>
            <button
              onClick={retry}
              disabled={busy}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {busy ? "Retrying…" : "Try again"}
            </button>
            {!submission.ai_feedback && <AiFallback submission={submission} onDone={onRetried} />}
          </div>
        )}
      </div>
      {submission.ai_feedback && <AiFeedbackCard feedback={submission.ai_feedback} />}
    </div>
  )
}
