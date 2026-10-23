import type { Submission } from "../../lib/assessments"
import { formatChange, formatScore, summarizeLearners } from "../../lib/progress"

const fmt = (value: number | null, unit: string) =>
  value === null ? "—" : `${Math.round(value * 100) / 100}${unit ? ` ${unit}` : ""}`

/** Pre/post comparison for one learner (paper formulas), with a learner picker. */
export default function LearnerProgress({
  submissions,
  error,
  learnerId,
  onSelect,
}: {
  submissions: Submission[] | null
  error: string | null
  learnerId: string | null
  onSelect: (learnerId: string) => void
}) {
  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading…</p>

  const learners = summarizeLearners(submissions)
  if (!learners.length) {
    return <p className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">No learner data yet. Progress appears once assigned learners submit recordings.</p>
  }
  const current = learners.find((l) => l.learnerId === learnerId) ?? learners[0]
  const { comparison, preScore, postScore } = current.journey

  return (
    <section>
      <select
        value={current.learnerId}
        onChange={(e) => onSelect(e.target.value)}
        className="mb-5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-kez-blue sm:w-80"
      >
        {learners.map((l) => (
          <option key={l.learnerId} value={l.learnerId}>
            {l.name}
          </option>
        ))}
      </select>

      <div className="rounded-3xl bg-kez-blue p-5 text-white sm:p-8">
        <p className="text-sm font-bold uppercase text-kez-yellow">{current.name} · Speaking progress</p>
        <div className="mt-5 flex flex-wrap items-center gap-5 sm:gap-7">
          <div>
            <p className="text-xs text-blue-200">PRE-ASSESSMENT</p>
            <p className="text-4xl font-extrabold sm:text-5xl">{formatScore(preScore)}</p>
          </div>
          <span className="text-3xl text-kez-yellow">→</span>
          <div>
            <p className="text-xs text-blue-200">POST-ASSESSMENT</p>
            <p className="text-4xl font-extrabold sm:text-5xl">{formatScore(postScore)}</p>
          </div>
          <div className="rounded-2xl bg-kez-yellow p-4 text-kez-dark">
            <p className="text-xs font-bold">CHANGE</p>
            <p className="text-2xl font-extrabold">
              {comparison.scoreChange === null ? "—" : `${formatChange(comparison.scoreChange)} points`}
            </p>
            <p className="text-xs">
              {comparison.percentChange === null ? "Needs both assessments" : `${formatChange(comparison.percentChange)}% change`}
            </p>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-blue-200">
          Machine-generated estimates; your adjusted score is used when you’ve set one.
        </p>
      </div>

      <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-extrabold">Measured change</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-3">Measure</th>
                <th className="pb-3">Pre</th>
                <th className="pb-3">Post</th>
                <th className="pb-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {comparison.metrics.map((m) => (
                <tr key={m.label} className="border-t border-slate-50">
                  <td className="py-3 font-bold">{m.label}</td>
                  <td className="py-3 text-slate-600">{fmt(m.pre, m.unit)}</td>
                  <td className="py-3 font-bold text-kez-blue">{fmt(m.post, m.unit)}</td>
                  <td className="py-3 text-slate-600">{m.pre !== null && m.post !== null ? formatChange(m.post - m.pre) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-slate-400">
          Compares the latest completed pre- and post-assessment. Lower pauses can mean smoother speech; interpret with the recordings.
        </p>
      </div>
    </section>
  )
}
