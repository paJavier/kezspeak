import { useEffect, useState } from "react"
import { listTasks, type AssessmentTask, type Submission } from "../../lib/assessments"
import { JOURNEY_STEPS, learnerJourney, nextTaskFor, stepStatus } from "../../lib/progress"

const hints = [
  "Record your first speaking response so we can measure your starting point.",
  "Practice with speaking activities. Each one gives you new measurements and feedback.",
  "Take your post-assessment to see how much you’ve improved.",
  "Your pre- and post-assessment comparison is ready in Results.",
]

/** Assess → Practice → Reassess → Measure, from the learner's real submissions. */
export default function AssessmentPath({
  submissions,
  error,
  onStartTask,
  onNavigate,
}: {
  submissions: Submission[] | null
  error: string | null
  onStartTask: (taskId: string | null) => void
  onNavigate: (page: string) => void
}) {
  const [tasks, setTasks] = useState<AssessmentTask[]>([])
  useEffect(() => {
    listTasks().then(setTasks).catch(() => setTasks([]))
  }, [])

  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading…</p>

  const journey = learnerJourney(submissions)
  const next = nextTaskFor(journey, tasks)

  return (
    <section className="max-w-4xl">
      <p className="text-slate-500">Your assessment path makes progress easy to see.</p>
      <div className="mt-6 space-y-3 sm:mt-8">
        {JOURNEY_STEPS.map((name, i) => {
          const status = stepStatus(journey, i)
          const current = status === "Up next"
          return (
            <div key={name} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm sm:gap-5 sm:p-5">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full font-bold ${status === "Completed" ? "bg-green-500 text-white" : current ? "bg-kez-blue text-white" : "bg-slate-100"}`}
              >
                {status === "Completed" ? "✓" : current ? `0${i + 1}` : "🔒"}
              </span>
              <div className="min-w-0 flex-1">
                <b>{name}</b>
                <p className="text-sm text-slate-500">
                  {status}
                  {i === 1 && journey.practiceCount > 0 ? ` · ${journey.practiceCount} completed` : ""}
                </p>
              </div>
              {current && journey.stage < 4 && (
                <button onClick={() => onStartTask(next?.id ?? null)} className="shrink-0 rounded-lg bg-kez-blue-light px-3 py-2 text-xs font-bold text-kez-blue">
                  Start
                </button>
              )}
              {i === 3 && journey.stage === 4 && (
                <button onClick={() => onNavigate("results")} className="shrink-0 rounded-lg bg-kez-blue-light px-3 py-2 text-xs font-bold text-kez-blue">
                  View
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-7 rounded-2xl bg-kez-yellow-light p-5 text-sm text-amber-900">💡 {hints[journey.stage - 1]}</p>
    </section>
  )
}
