import { useEffect } from "react"
import { Printer, X } from "lucide-react"
import { comparePrePost, type Submission } from "../lib/assessments"
import { EXAMS, formatChange, formatExamScore, gapToTarget, PRACTICE_ESTIMATE_NOTE, TRADEMARK_NOTE, type RubricComparison } from "../lib/exams"
import type { LearnerGoal } from "../lib/goals"
import { describeGoal } from "./ExamGoalCard"
import { CriterionBars } from "./ExamProgress"

const fmt = (value: number | null, unit: string) => (value === null ? "—" : `${Math.round(value * 100) / 100}${unit ? ` ${unit}` : ""}`)
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })

/**
 * Printable pre → post progress report. "Print / Save as PDF" uses the
 * browser's print dialog; the @media print rules in index.css print only this.
 */
export default function ProgressReport({
  learnerName,
  goal,
  comparison,
  pre,
  post,
  submissions,
  onClose,
}: {
  learnerName: string
  goal: LearnerGoal | null
  comparison: RubricComparison
  pre: Submission
  post: Submission
  submissions: Submission[]
  onClose: () => void
}) {
  const exam = EXAMS[comparison.exam]
  const target = goal?.exam === comparison.exam ? goal.target_score : null
  const gap = gapToTarget(comparison.post, target)
  const { metrics } = comparePrePost(submissions)
  const notes = exam.criteria
    .map((c) => ({ label: c.label, note: post.feedback?.rubric?.notes?.[c.key] }))
    .filter((n): n is { label: string; note: string } => Boolean(n.note))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="print-report-backdrop fixed inset-0 z-[60] overflow-y-auto bg-slate-900/50 p-4" onClick={onClose} role="presentation">
      <div className="mx-auto my-6 max-w-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="no-print mb-3 flex justify-end gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-kez-blue px-4 py-2.5 text-sm font-bold text-white">
            <Printer size={16} aria-hidden="true" /> Print / Save as PDF
          </button>
          <button type="button" onClick={onClose} aria-label="Close report" className="grid size-10 place-items-center rounded-xl bg-white text-slate-600">
            <X size={18} />
          </button>
        </div>

        <article className="print-report rounded-3xl bg-white p-8 shadow-xl sm:p-10">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-bold tracking-widest text-kez-blue">KEZSPEAK · SPEAKING PROGRESS REPORT</p>
              <h1 id="report-title" className="mt-2 text-2xl font-extrabold text-kez-dark">{learnerName}</h1>
              <p className="mt-1 text-sm text-slate-500">{goal ? describeGoal(goal) : exam.name}</p>
            </div>
            <img src="/images/logo-mark.png" alt="" className="h-16 w-auto" />
          </header>

          <section className="mt-6">
            <h2 className="text-sm font-extrabold text-kez-dark">{exam.name}: practice estimate</h2>
            <table className="mt-3 w-full text-left text-sm">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">Pre-test ({date(pre.submitted_at)})</td>
                  <td className="py-2 text-right font-bold">{formatExamScore(exam.id, comparison.pre)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">Post-test ({date(post.submitted_at)})</td>
                  <td className="py-2 text-right font-bold">{formatExamScore(exam.id, comparison.post)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">Change</td>
                  <td className="py-2 text-right font-extrabold text-kez-blue">{formatChange(comparison.change)}</td>
                </tr>
                {target !== null && (
                  <tr>
                    <td className="py-2 text-slate-500">Target</td>
                    <td className="py-2 text-right font-bold">
                      {formatExamScore(exam.id, target)} {gap !== null && <span className="font-normal text-slate-500">({gap === 0 ? "reached" : `${gap.toFixed(1)} to go`})</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-extrabold text-kez-dark">By criterion (grey = pre-test, blue = post-test)</h2>
            <CriterionBars comparison={comparison} />
          </section>

          {(notes.length > 0 || post.feedback?.comment) && (
            <section className="mt-8">
              <h2 className="text-sm font-extrabold text-kez-dark">Tutor's notes</h2>
              {post.feedback?.comment && <p className="mt-2 text-sm leading-6 text-slate-700">{post.feedback.comment}</p>}
              {notes.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {notes.map((n) => (
                    <li key={n.label}>
                      <b>{n.label}:</b> {n.note}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-sm font-extrabold text-kez-dark">Measured speech features</h2>
            <p className="text-xs text-slate-500">Measured automatically from the recordings; supporting information for your tutor's scores.</p>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2">Measure</th>
                  <th className="py-2">Pre</th>
                  <th className="py-2">Post</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.label} className="border-t border-slate-100">
                    <td className="py-2">{m.label}</td>
                    <td className="py-2">{fmt(m.pre, m.unit)}</td>
                    <td className="py-2 font-bold">{fmt(m.post, m.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">
            <p>{PRACTICE_ESTIMATE_NOTE} Scores follow the exam's public speaking criteria and are given by the learner's KezSpeak tutor.</p>
            <p>{TRADEMARK_NOTE}</p>
            <p>Generated {new Date().toLocaleString()} by KezSpeak · Kez Tutorial Service.</p>
          </footer>
        </article>
      </div>
    </div>
  )
}
