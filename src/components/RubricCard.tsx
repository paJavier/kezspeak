import { EXAMS, formatExamScore, isExamId, overallFor, PRACTICE_ESTIMATE_NOTE, TRADEMARK_NOTE, type Rubric } from "../lib/exams"

/** The tutor's exam rubric for one recording, as the learner (or tutor) reads it. */
export default function RubricCard({ rubric }: { rubric: Rubric }) {
  if (!isExamId(rubric.exam)) return null
  const exam = EXAMS[rubric.exam]
  const overall = overallFor(rubric)

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-kez-blue">{exam.name.toUpperCase()}</p>
          <h3 className="mt-1 font-extrabold">Tutor's exam-style scores</h3>
        </div>
        <div className="rounded-2xl bg-kez-blue-light px-4 py-2 text-right">
          <p className="text-[10px] font-bold text-kez-blue">PRACTICE ESTIMATE</p>
          <p className="text-2xl font-extrabold text-kez-dark">{formatExamScore(exam.id, overall)}</p>
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        {exam.criteria.map((criterion) => {
          const value = rubric.scores?.[criterion.key]
          const note = rubric.notes?.[criterion.key]
          const width = typeof value === "number" ? `${(value / exam.max) * 100}%` : "0%"
          return (
            <li key={criterion.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-bold text-slate-700">{criterion.label}</span>
                <b className="text-kez-blue">{typeof value === "number" ? `${value} / ${exam.max}` : "—"}</b>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-2 rounded-full bg-kez-blue" style={{ width }} />
              </div>
              {note && <p className="mt-1.5 text-xs leading-5 text-slate-500">{note}</p>}
            </li>
          )
        })}
      </ul>

      <p className="mt-5 text-[11px] leading-4 text-slate-400">
        {PRACTICE_ESTIMATE_NOTE} {TRADEMARK_NOTE}
      </p>
    </div>
  )
}
