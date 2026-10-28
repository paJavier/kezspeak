import type { Submission } from "../../lib/assessments"
import {
  classworkState,
  displayGrade,
  formatDue,
  latestSubmissionFor,
  stateLabels,
  stateStyles,
  type Assignment,
} from "../../lib/classroom"

/**
 * Work a tutor assigned to this learner (loaded by useMyAssignments). Open work
 * can be recorded until the due date; after that it leaves the to-do list and
 * shows as Missing (0).
 */
export default function MyAssignments({
  assignments,
  error,
  submissions,
  onStart,
}: {
  assignments: Assignment[] | null
  error: string | null
  submissions: Submission[] | null
  onStart: (taskId: string) => void
}) {
  if (error) return <p className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
  if (!assignments?.length) return null

  // Open = can still record (to do, or turned in and before the deadline).
  const open = assignments
    .filter((a) => {
      const state = classworkState(a)
      return state === "todo" || (state === "turned_in" && (!a.due_at || new Date(a.due_at) > new Date()))
    })
    .sort((x, y) => (x.due_at ?? "9999").localeCompare(y.due_at ?? "9999"))
  const done = assignments.filter((a) => !open.includes(a))

  return (
    <section className="mb-10">
      <h2 className="text-lg font-extrabold">Assigned to you</h2>
      {!open.length ? (
        <p className="mt-3 rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-sm">You're all caught up. No open assignments right now.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {open.map((a) => {
            const state = classworkState(a)
            return (
              <article key={a.id} className="flex flex-col rounded-3xl bg-white p-5 shadow-sm">
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stateStyles[state]}`}>{stateLabels[state]}</span>
                <h3 className="mt-3 font-extrabold">{a.task?.title ?? "Speaking task"}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{a.task?.prompt}</p>
                <p className="mt-3 text-xs font-bold text-slate-700">Due {formatDue(a.due_at)}</p>
                <div className="mt-auto pt-5">
                  <button onClick={() => onStart(a.task_id)} className="w-full rounded-xl bg-kez-blue py-3 text-sm font-bold text-white">
                    {state === "turned_in" ? "Record again" : "Start"}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-extrabold">Past assignments</h3>
          {done.map((a) => {
            const state = classworkState(a)
            const grade = displayGrade(a)
            const turnedIn = latestSubmissionFor(a, submissions)
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-3 first:border-0">
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">{a.task?.title ?? "Speaking task"}</b>
                  <span className="text-xs text-slate-500">
                    Due {formatDue(a.due_at)}
                    {turnedIn && ` · turned in ${formatDue(turnedIn.submitted_at)}`}
                  </span>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${stateStyles[state]}`}>
                  {state === "turned_in" ? "Waiting for your tutor's grade" : stateLabels[state]}
                  {grade !== null && ` · ${grade}/100`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
