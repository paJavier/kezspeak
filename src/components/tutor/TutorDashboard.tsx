import type { Submission } from "../../lib/assessments"
import type { Person } from "../../lib/classroom"
import { formatChange, needsReview, relativeDate, summarizeLearners } from "../../lib/progress"

const kindLabel = (s: Submission) =>
  s.task?.kind === "pre" ? "Pre-Assessment" : s.task?.kind === "post" ? "Post-Assessment" : "Speaking Practice"

/** Tutor/admin home: real counts and the recordings still waiting for review. */
export default function TutorDashboard({
  submissions,
  people,
  error,
  onReview,
}: {
  submissions: Submission[] | null
  people?: Person[] | null
  error: string | null
  onReview: (submissionId: string | null) => void
}) {
  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading your learners…</p>

  const learners = summarizeLearners(submissions, people)
  const pending = submissions.filter(needsReview)
  const completed = submissions.filter((s) => s.status === "completed").length
  const changes = learners.map((l) => l.journey.comparison.scoreChange).filter((c): c is number => c !== null)
  const average = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null

  const stats: [string, string, string, string][] = [
    ["👥", "Learners", String(learners.length), "bg-kez-blue-light"],
    ["🎧", "Pending Reviews", String(pending.length), "bg-kez-yellow-light"],
    ["✓", "Recordings Analyzed", String(completed), "bg-green-50"],
    ["↗", "Average Improvement", average === null ? "—" : `${formatChange(average)} pts`, "bg-pink-50"],
  ]

  return (
    <>
      <p className="text-slate-500">Here’s how your learners are progressing.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-7 sm:gap-5 xl:grid-cols-4">
        {stats.map(([icon, label, value, bg]) => (
          <div key={label} className={`rounded-3xl p-4 sm:p-6 ${bg}`}>
            <span className="text-2xl">{icon}</span>
            <p className="mt-4 text-xs font-semibold text-slate-600 sm:mt-6 sm:text-sm">{label}</p>
            <p className="mt-1 text-2xl font-extrabold sm:text-3xl">{value}</p>
          </div>
        ))}
      </div>
      {average !== null && (
        <p className="mt-3 text-[11px] text-slate-400">
          Average post − pre change across {changes.length} learner{changes.length === 1 ? "" : "s"} with both assessments (tutor-adjusted scores where available).
        </p>
      )}

      <section className="mt-7 rounded-3xl bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold">Needs Your Attention</h2>
            <p className="mt-1 text-sm text-slate-500">Analyzed recordings waiting for your feedback.</p>
          </div>
          <button onClick={() => onReview(null)} className="text-sm font-bold text-kez-blue">
            View all →
          </button>
        </div>
        <div className="mt-6 grid gap-3">
          {!pending.length && (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              {submissions.length
                ? "You’re all caught up. 🎉"
                : learners.length
                  ? "No recordings yet. Assign work under Classwork to get your learners started."
                  : "No learners yet. An administrator sets each student's tutor under Users."}
            </p>
          )}
          {pending.slice(0, 6).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-4 sm:gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-kez-blue">
                {(s.learner_name ?? "?")[0]?.toUpperCase()}
              </span>
              <div className="min-w-40 flex-1">
                <p className="font-bold">{s.learner_name ?? "Learner"}</p>
                <p className="text-xs text-slate-500">
                  {s.task?.title ?? kindLabel(s)} · {kindLabel(s)}
                </p>
              </div>
              <p className="text-xs text-slate-500">Submitted {relativeDate(s.submitted_at)}</p>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Pending review</span>
              <button onClick={() => onReview(s.id)} className="rounded-lg bg-kez-blue px-4 py-2 text-xs font-bold text-white">
                Review
              </button>
            </div>
          ))}
          {pending.length > 6 && <p className="text-xs text-slate-500">+{pending.length - 6} more in Submissions.</p>}
        </div>
      </section>
    </>
  )
}
