import { FormEvent, useEffect, useState } from "react"
import useSubmission from "../../hooks/useSubmission"
import { listSubmissions, saveFeedback, statusLabels, type Submission, type TaskKind } from "../../lib/assessments"
import AudioPlayer from "../AudioPlayer"
import AiComparison from "./AiComparison"
import EvaluationSummary from "../EvaluationSummary"
import ProcessingStatus from "../ProcessingStatus"

const tabs: [TaskKind | "all", string][] = [
  ["all", "All"],
  ["pre", "Pre-Assessment"],
  ["post", "Post-Assessment"],
  ["practice", "Practice"],
]

function FeedbackForm({ submission, tutorId, onSaved }: { submission: Submission; tutorId: string; onSaved: () => void }) {
  const existing = submission.feedback
  const machine = submission.evaluation?.predicted_score ?? null
  const [comment, setComment] = useState(existing?.comment ?? "")
  const [strengths, setStrengths] = useState(existing?.strengths ?? "")
  const [improvements, setImprovements] = useState(existing?.improvements ?? "")
  const [adjust, setAdjust] = useState(existing?.adjusted_score !== null && existing?.adjusted_score !== undefined)
  const [score, setScore] = useState(Math.round(existing?.adjusted_score ?? machine ?? 70))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) {
      setMessage({ ok: false, text: "Write a short comment for the learner first." })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await saveFeedback({
        submissionId: submission.id,
        tutorId,
        comment: comment.trim(),
        strengths: strengths.trim(),
        improvements: improvements.trim(),
        adjustedScore: adjust ? score : null,
      })
      setMessage({ ok: true, text: "✓ Evaluation saved. The learner can now see your feedback." })
      onSaved()
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-extrabold">Your evaluation</h2>
      <p className="mt-1 text-xs text-slate-500">
        The machine estimate supports your judgment; your score is the one the learner sees as final.
      </p>

      <label className="mt-5 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} className="accent-kez-blue" />
        Adjust the score
      </label>
      {adjust && (
        <div className="mt-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Machine estimate {machine === null ? "—" : machine.toFixed(0)}</span>
            <b className="text-kez-blue">{score} / 100</b>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="mt-2 w-full accent-kez-blue"
          />
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write constructive feedback for the learner..."
        className="mt-5 h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-kez-blue"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <textarea
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          placeholder="Strengths (optional)"
          className="h-20 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-kez-blue"
        />
        <textarea
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          placeholder="Areas to work on (optional)"
          className="h-20 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-kez-blue"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : existing ? "Update evaluation" : "Submit evaluation"}
      </button>
      {message && (
        <p className={`mt-4 rounded-xl p-3 text-xs font-bold ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}

function ReviewDetail({ id, tutorId, onChanged }: { id: string; tutorId: string; onChanged: () => void }) {
  const { submission, error, refresh } = useSubmission(id)
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
  if (!submission) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-bold text-slate-400">
          {submission.learner_name ?? "Learner"} · {new Date(submission.submitted_at).toLocaleString()}
        </p>
        <h2 className="mt-1 text-xl font-extrabold">{submission.task?.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{submission.task?.prompt}</p>
        <div className="mt-4">
          <AudioPlayer path={submission.audio_path} />
        </div>
      </div>
      {submission.status === "completed" && submission.evaluation ? (
        <>
          <EvaluationSummary evaluation={submission.evaluation} feedback={submission.feedback} audience="tutor" />
          <AiComparison submissionId={submission.id} evaluation={submission.evaluation} />
          <FeedbackForm
            key={submission.feedback?.updated_at ?? "new"}
            submission={submission}
            tutorId={tutorId}
            onSaved={() => {
              refresh()
              onChanged()
            }}
          />
          <p className="text-[11px] text-slate-400">
            Model {submission.evaluation.model_version} · features {submission.evaluation.feature_version}
          </p>
        </>
      ) : (
        <ProcessingStatus submission={submission} onRetried={refresh} />
      )}
    </div>
  )
}

/** Real submissions from the tutor's assigned learners (filtered by RLS). */
export default function SubmissionReview({
  tutorId,
  initialSelectedId = null,
  onChanged,
}: {
  tutorId: string
  initialSelectedId?: string | null
  onChanged?: () => void
}) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TaskKind | "all">("all")
  const [selected, setSelected] = useState<string | null>(initialSelectedId)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    listSubmissions()
      .then(setSubmissions)
      .catch((err: Error) => setError(err.message))
  }, [version])

  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading submissions…</p>

  const visible = submissions.filter((s) => tab === "all" || s.task?.kind === tab)

  return (
    <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
      <section>
        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === id ? "bg-kez-blue text-white" : "bg-white text-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm">
          {!visible.length && (
            <p className="p-4 text-sm text-slate-500">
              No submissions yet. You see recordings from learners who have an assignment with you.
            </p>
          )}
          {visible.map((s) => {
            const reviewed = !!s.feedback
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left ${s.id === selected ? "bg-kez-blue-light" : "hover:bg-slate-50"
                  }`}
              >
                <span>
                  <b className="block text-sm">{s.learner_name ?? "Learner"}</b>
                  <span className="text-xs text-slate-500">
                    {s.task?.title} · {new Date(s.submitted_at).toLocaleDateString()}
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${reviewed
                    ? "bg-green-50 text-green-700"
                    : s.status === "completed"
                      ? "bg-amber-100 text-amber-700"
                      : s.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                >
                  {reviewed ? "Reviewed" : s.status === "completed" ? "Pending review" : statusLabels[s.status]}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      {selected ? (
        <ReviewDetail key={selected} id={selected} tutorId={tutorId} onChanged={() => {
            setVersion((v) => v + 1)
            onChanged?.()
          }} />
      ) : (
        <p className="rounded-3xl bg-white p-8 text-sm text-slate-500 shadow-sm">Select a submission to review it.</p>
      )}
    </div>
  )
}
