import { useEffect, useState } from "react"
import { listTasks, type AssessmentTask, type TaskKind } from "../lib/assessments"

const kindLabels: Record<TaskKind, string> = { pre: "Pre-Assessment", post: "Post-Assessment", practice: "Practice" }
const icons: Record<TaskKind, string> = { pre: "🎯", post: "🏁", practice: "🎙️" }

/**
 * Speaking tasks from the database (managed by tutors and admins under Tasks).
 * Learners get a Start button; tutors see the catalog read-only.
 */
export default function TaskCatalog({
  onStart,
  openTaskIds,
}: {
  onStart?: (taskId: string) => void
  /** Learner view: pre/post tasks appear only when assigned (open assignment). */
  openTaskIds?: Set<string>
}) {
  const [tasks, setTasks] = useState<AssessmentTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TaskKind | "all">("all")

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!tasks) return <p className="text-slate-500">Loading activities…</p>

  const visible = tasks.filter(
    (t) => (filter === "all" || t.kind === filter) && (!openTaskIds || t.kind === "practice" || openTaskIds.has(t.id)),
  )

  return (
    <>
      <p className="text-slate-500">Practice your English through meaningful speaking tasks.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", "practice", "pre", "post"] as const).map((kind) => (
          <button
            key={kind}
            onClick={() => setFilter(kind)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${filter === kind ? "bg-kez-blue text-white" : "bg-white text-slate-500"}`}
          >
            {kind === "all" ? "All" : kindLabels[kind]}
          </button>
        ))}
      </div>
      {!visible.length ? (
        <p className="mt-6 rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
          {openTaskIds && (filter === "pre" || filter === "post")
            ? "Your tutor hasn't assigned this assessment yet. It will appear here once they do."
            : "No speaking tasks here yet. A tutor or admin can add them under Tasks."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((task) => (
            <article key={task.id} className="flex flex-col rounded-3xl bg-white p-5 shadow-sm">
              <span className="grid size-12 place-items-center rounded-2xl bg-kez-blue-light text-2xl">{icons[task.kind]}</span>
              <h2 className="mt-5 font-extrabold">{task.title}</h2>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{task.prompt}</p>
              <p className="mt-4 text-xs leading-6 text-slate-500">
                Type <b className="float-right text-slate-700">{kindLabels[task.kind]}</b>
                <br />
                {task.skill_focus && (
                  <>
                    Skill <b className="float-right text-slate-700">{task.skill_focus}</b>
                    <br />
                  </>
                )}
                Time limit <b className="float-right text-slate-700">{Math.round(task.duration_seconds / 60) || 1} min</b>
              </p>
              {onStart && (
                <div className="mt-auto pt-6">
                  <button onClick={() => onStart(task.id)} className="w-full rounded-xl bg-kez-blue-light py-3 text-sm font-bold text-kez-blue">
                    Start
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
