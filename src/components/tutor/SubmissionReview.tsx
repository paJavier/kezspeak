import { FormEvent, useEffect, useState } from "react"
import useSubmission from "../../hooks/useSubmission"
import { listSubmissions, saveFeedback, statusLabels, type Submission, type TaskKind } from "../../lib/assessments"
import AudioPlayer from "../AudioPlayer"
import AiComparison from "./AiComparison"
import { MetricGrid, ScoreCards, TranscriptCard, TutorFeedbackCard } from "../EvaluationSummary"
import ProcessingStatus from "../ProcessingStatus"
import RubricPanel, { type RubricDraft } from "./RubricPanel"
import { overallFor, type ExamId } from "../../lib/exams"
import { fetchGoal } from "../../lib/goals"

// Feedback boxes grow with the text instead of scrolling inside a small box.
const growing = "[field-sizing:content] resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-kez-blue"

const tabs: [TaskKind | "all", string][] = [
  ["all", "All"],
  ["pre", "Pre-Assessment"],
  ["post", "Post-Assessment"],
  ["practice", "Practice"],
]

function FeedbackForm({
  submission,
  tutorId,
  goalExam,
  onSaved,
}: {
  submission: Submission
  tutorId: string
  /** The learner's exam goal, or null when they have none. */
  goalExam: ExamId | null
  onSaved: () => void
}) {
  const existing = submission.feedback
  const machine = submission.evaluation?.predicted_score ?? null
  const [comment, setComment] = useState(existing?.comment ?? "")
  const [strengths, setStrengths] = useState(existing?.strengths ?? "")
  const [improvements, setImprovements] = useState(existing?.improvements ?? "")
  const [adjust, setAdjust] = useState(existing?.adjusted_score !== null && existing?.adjusted_score !== undefined)
  const [score, setScore] = useState(Math.round(existing?.adjusted_score ?? machine ?? 70))
  const [rubric, setRubric] = useState<RubricDraft>({
    exam: existing?.rubric?.exam ?? goalExam,
    scores: existing?.rubric?.scores ?? {},
    notes: existing?.rubric?.notes ?? {},
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  // Pre/post tests of a learner with a goal must be scored on their exam rubric.
  const isPrePost = submission.task?.kind === "pre" || submission.task?.kind === "post"
  const rubricRequired = isPrePost && goalExam !== null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) {
      setMessage({ ok: false, text: "Write a short comment for the learner first." })
      return
    }
    const scored = Object.keys(rubric.scores).length
    const complete = rubric.exam !== null && overallFor({ exam: rubric.exam, scores: rubric.scores }) !== null
    if ((rubricRequired && !complete) || (scored > 0 && !complete)) {
      setMessage({ ok: false, text: "Score every criterion of the exam rubric first." })
      return
    }
    // Only send the rubric when it's used (or being cleared), so saving still works before the migration.
    const notes = Object.fromEntries(Object.entries(rubric.notes).filter(([, note]) => note.trim()))
    const rubricValue = complete && rubric.exam ? { exam: rubric.exam, scores: rubric.scores, notes } : existing?.rubric ? null : undefined
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
        rubric: rubricValue,
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

      <RubricPanel draft={rubric} onChange={setRubric} evaluation={submission.evaluation} goalExam={goalExam} required={rubricRequired} />

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write constructive feedback for the learner..."
        className={`mt-5 min-h-28 max-h-72 w-full ${growing}`}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
        <textarea
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          placeholder="Strengths (optional)"
          className={`min-h-20 max-h-48 ${growing}`}
        />
        <textarea
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          placeholder="Areas to work on (optional)"
          className={`min-h-20 max-h-48 ${growing}`}
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

type EvidenceTab = "transcript" | "ai"

function ReviewDetail({ id, tutorId, onChanged }: { id: string; tutorId: string; onChanged: () => void }) {
  const { submission, error, refresh } = useSubmission(id)
  const [showPrompt, setShowPrompt] = useState(false)
  const [tab, setTab] = useState<EvidenceTab>("transcript")
  // The learner's exam goal picks the rubric. undefined = still loading.
  const [goalExam, setGoalExam] = useState<ExamId | null | undefined>(undefined)
  const learnerId = submission?.learner_id
  useEffect(() => {
    if (!learnerId) return
    let active = true
    fetchGoal(learnerId)
      .then((goal) => active && setGoalExam(goal?.exam ?? null))
      // No goal table yet (migration not applied) or no access: score without a goal.
      .catch(() => active && setGoalExam(null))
    return () => {
      active = false
    }
  }, [learnerId])
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
  if (!submission) return <p className="rounded-3xl bg-white p-8 text-sm text-slate-500 shadow-sm">Loading…</p>

  const header = (
    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold text-slate-400">
        {submission.learner_name ?? "Learner"} · {new Date(submission.submitted_at).toLocaleString()}
      </p>
      <h2 className="mt-1 text-xl font-extrabold">{submission.task?.title}</h2>
      {submission.task?.prompt && (
        <>
          <p className={`mt-2 whitespace-pre-line text-sm text-slate-500 ${showPrompt ? "" : "line-clamp-2"}`}>{submission.task.prompt}</p>
          <button type="button" onClick={() => setShowPrompt(!showPrompt)} className="mt-1 text-xs font-bold text-kez-blue">
            {showPrompt ? "Show less" : "Show full prompt"}
          </button>
        </>
      )}
      <div className="mt-4">
        <AudioPlayer path={submission.audio_path} />
      </div>
    </div>
  )

  if (submission.status !== "completed" || !submission.evaluation) {
    return (
      <div className="space-y-5">
        {header}
        <ProcessingStatus submission={submission} onRetried={refresh} />
      </div>
    )
  }

  const evaluation = submission.evaluation
  const tabs: [EvidenceTab, string][] = [
    ["transcript", "Transcript"],
    ["ai", "AI comparison"],
  ]

  return (
    <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* Evidence: what the learner did and what the machine measured. */}
      <div className="min-w-0 space-y-5">
        {header}
        <ScoreCards evaluation={evaluation} feedback={submission.feedback} audience="tutor" compact />
        <MetricGrid evaluation={evaluation} compact />
        <div className="rounded-3xl bg-white shadow-sm">
          <div className="flex gap-1 border-b border-slate-100 px-4 pt-3" role="tablist" aria-label="Recording details">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${tab === value ? "border-kez-blue text-kez-blue" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-5 sm:p-6" role="tabpanel">
            {tab === "transcript" ? (
              <TranscriptCard evaluation={evaluation} bare />
            ) : (
              // Loads only when opened; Gemini runs only when the tutor asks.
              <AiComparison submissionId={submission.id} evaluation={evaluation} />
            )}
          </div>
        </div>
        {submission.feedback && <TutorFeedbackCard feedback={submission.feedback} />}
      </div>

      {/* Evaluation: stays in view on wide screens while the tutor reads. */}
      {/* Own scroll on wide screens: with the rubric the form can be taller than the window. */}
      <div className="min-w-0 space-y-3 2xl:sticky 2xl:top-6 2xl:max-h-[calc(100dvh-3rem)] 2xl:overflow-y-auto 2xl:pr-1 2xl:[scrollbar-width:thin]">
        {goalExam === undefined ? (
          <p className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">Loading the evaluation form…</p>
        ) : (
          <FeedbackForm
            key={`${submission.feedback?.updated_at ?? "new"}-${goalExam ?? "none"}`}
            submission={submission}
            tutorId={tutorId}
            goalExam={goalExam}
            onSaved={() => {
              refresh()
              onChanged()
            }}
          />
        )}
        <p className="px-2 text-[11px] text-slate-400">
          Model {evaluation.model_version} · features {evaluation.feature_version}
        </p>
      </div>
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
    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* The list keeps its own scroll so it stays beside the recording being reviewed. */}
      <section className="min-w-0 xl:sticky xl:top-6 xl:flex xl:max-h-[calc(100dvh-3rem)] xl:flex-col">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${tab === id ? "bg-kez-blue text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {label.replace("-Assessment", "")}
            </button>
          ))}
        </div>
        <div className="mt-4 min-h-0 overflow-y-auto rounded-3xl bg-white p-2 shadow-sm">
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
                <span className="min-w-0">
                  <b className="block truncate text-sm">{s.learner_name ?? "Learner"}</b>
                  <span className="block truncate text-xs text-slate-500">{s.task?.title}</span>
                  <span className="block text-[11px] text-slate-400">{new Date(s.submitted_at).toLocaleDateString()}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${reviewed
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
