import { useEffect, useState } from "react"
import { listTasks, type AssessmentTask, type Submission } from "../../lib/assessments"
import { JOURNEY_STEPS, formatChange, formatScore, learnerJourney, nextTaskFor, stepStatus } from "../../lib/progress"

/** Learner home: real journey stage, latest scores and tutor feedback. */
export default function StudentDashboard({
  submissions,
  error,
  onNavigate,
  onStartTask,
}: {
  submissions: Submission[] | null
  error: string | null
  onNavigate: (page: string) => void
  onStartTask: (taskId: string | null) => void
}) {
  const [tasks, setTasks] = useState<AssessmentTask[]>([])
  useEffect(() => {
    listTasks().then(setTasks).catch(() => setTasks([]))
  }, [])

  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading your progress…</p>

  const journey = learnerJourney(submissions)
  const next = nextTaskFor(journey, tasks)
  const latest = journey.latest?.evaluation ?? null
  const feedback = journey.latestFeedback?.feedback ?? null

  return (
    <>
      <p className="text-slate-500">Let’s see how your English is growing.</p>
      <section className="mt-6 rounded-3xl bg-kez-blue p-5 text-white sm:mt-8 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wider text-kez-yellow">YOUR SPEAKING JOURNEY</p>
            <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">
              {journey.stage === 1
                ? "Start with your pre-assessment."
                : journey.stage === 4
                  ? "You completed your pre- and post-assessment!"
                  : "You’re building momentum."}
            </h2>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">Stage {journey.stage} of 4</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-4">
          {JOURNEY_STEPS.map((label, i) => {
            const status = stepStatus(journey, i)
            return (
              <div key={label} className={`rounded-2xl p-4 ${status === "Up next" ? "bg-kez-yellow text-kez-dark" : "bg-white/10"}`}>
                <b className="font-mono text-xs">{status === "Completed" ? "✓" : `0${i + 1}`}</b>
                <p className="mt-3 font-bold sm:mt-4">{label}</p>
                <p className="mt-1 text-xs opacity-70">{status}</p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold text-slate-400">YOUR ASSESSMENTS</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ["Pre", formatScore(journey.preScore)],
              ["Post", formatScore(journey.postScore)],
              ["Change", formatChange(journey.comparison.scoreChange)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-extrabold text-kez-blue">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            Machine-generated estimates out of 100, reviewed by your tutor. A tutor-adjusted score replaces the estimate.
          </p>
          <button onClick={() => onNavigate("results")} className="mt-4 text-sm font-bold text-kez-blue">
            View Results →
          </button>
        </section>
        <section className="rounded-3xl bg-kez-yellow-light p-5 sm:p-7">
          <p className="text-xs font-bold text-amber-700">UP NEXT</p>
          {next ? (
            <>
              <h2 className="mt-2 text-xl font-extrabold">{next.title}</h2>
              <p className="mt-3 text-sm text-amber-900">
                {next.skill_focus ? `${next.skill_focus} · ` : ""}
                {Math.round(next.duration_seconds / 60) || 1} min · {next.kind === "pre" ? "Pre-assessment" : next.kind === "post" ? "Post-assessment" : "Practice"}
              </p>
              <button onClick={() => onStartTask(next.id)} className="mt-6 rounded-xl bg-kez-dark px-4 py-3 text-sm font-bold text-white">
                🎤 Start
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-amber-900">No speaking tasks are available yet. Your tutor will add them soon.</p>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-extrabold">Latest Recording</h2>
          {latest ? (
            <>
              <p className="text-sm text-slate-500">{journey.latest?.task?.title}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Speech rate", `${Math.round(latest.acoustic_features.speech_rate)} wpm`],
                  ["Pauses", String(latest.acoustic_features.pause_count)],
                  ["Words", String(latest.nlp_features.word_count)],
                  ["Lexical diversity", latest.nlp_features.mattr.toFixed(2)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                    <p className="mt-1 font-extrabold">{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Your measurements will appear here after your first recording is analyzed.</p>
          )}
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-pink-100">💬</span>
            <div>
              <p className="font-extrabold">Feedback from your tutor</p>
              <p className="text-xs text-slate-400">{journey.latestFeedback?.task?.title ?? "Your speaking tutor"}</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            {feedback ? `“${feedback.comment}”` : "No feedback yet. Your tutor will review your recordings and leave comments here."}
          </p>
          {feedback && (
            <button onClick={() => onNavigate("feedback")} className="mt-5 text-sm font-bold text-kez-blue">
              View Feedback →
            </button>
          )}
        </section>
      </div>
    </>
  )
}
