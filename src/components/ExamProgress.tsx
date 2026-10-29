import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { comparePrePost, type Submission } from "../lib/assessments"
import {
  compareRubrics,
  EXAMS,
  formatChange,
  formatExamScore,
  gapToTarget,
  overallFor,
  PRACTICE_ESTIMATE_NOTE,
  TRADEMARK_NOTE,
  type RubricComparison,
} from "../lib/exams"
import { fetchGoal, type LearnerGoal } from "../lib/goals"
import { describeGoal } from "./ExamGoalCard"
import ProgressReport from "./ProgressReport"

/** Pre → post exam rubric for a learner, using the same pre/post pair as the research comparison. */
export function examProgressFor(submissions: Submission[]) {
  const { pre, post } = comparePrePost(submissions)
  const preRubric = pre?.feedback?.rubric ?? null
  const postRubric = post?.feedback?.rubric ?? null
  return { pre, post, preRubric, postRubric, comparison: compareRubrics(preRubric, postRubric) }
}

/** Pre vs post bars per criterion. `print-bar*` classes keep their colours when printed. */
export function CriterionBars({ comparison }: { comparison: RubricComparison }) {
  const exam = EXAMS[comparison.exam]
  const pct = (value: number | null) => `${value === null ? 0 : (value / exam.max) * 100}%`
  return (
    <ul className="space-y-4">
      {comparison.criteria.map((c) => (
        <li key={c.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-bold text-slate-700">{c.label}</span>
            <span className="text-xs text-slate-500">
              {c.pre ?? "—"} → <b className="text-kez-blue">{c.post ?? "—"}</b>
              {c.change !== null && c.change !== 0 && <span className="ml-1 font-bold">({formatChange(c.change)})</span>}
            </span>
          </div>
          <div className="mt-1.5 space-y-1" aria-hidden="true">
            <div className="h-2 rounded-full bg-[var(--viz-grid)]">
              <div className="print-bar-pre h-2 rounded-full bg-[var(--viz-neutral)]" style={{ width: pct(c.pre) }} />
            </div>
            <div className="h-2 rounded-full bg-[var(--viz-grid)]">
              <div className="print-bar h-2 rounded-full bg-[var(--viz-bar)]" style={{ width: pct(c.post) }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Exam-style progress card: overall pre → post, target gap and per-criterion
 * bars. Practice estimates from the tutor's rubric, never official scores.
 */
export default function ExamProgress({
  submissions,
  learnerId,
  learnerName,
  audience = "learner",
}: {
  submissions: Submission[]
  learnerId: string
  learnerName: string
  audience?: "learner" | "tutor"
}) {
  const [goal, setGoal] = useState<LearnerGoal | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetchGoal(learnerId)
      .then((g) => active && setGoal(g))
      // Goals are optional context here; without them the card still works.
      .catch(() => active && setGoal(null))
    return () => {
      active = false
    }
  }, [learnerId])

  const { pre, post, preRubric, postRubric, comparison } = examProgressFor(submissions)
  const scored = preRubric ?? postRubric
  if (!scored && !goal) return null

  const examId = comparison?.exam ?? scored?.exam ?? goal?.exam ?? "ielts"
  const exam = EXAMS[examId]
  const preOverall = comparison?.pre ?? overallFor(preRubric)
  const postOverall = comparison?.post ?? null
  const latest = postOverall ?? preOverall
  const target = goal?.exam === examId ? goal.target_score : null
  const gap = gapToTarget(latest, target)
  const you = audience === "learner"

  let status: string | null = null
  if (!preRubric) status = pre ? (you ? "Your tutor hasn't scored your pre-test on the exam rubric yet." : "Score the pre-test with the exam rubric under Submissions.") : you ? "Take your pre-assessment to get a starting score." : "No pre-assessment yet."
  else if (!post) status = you ? "Your post-assessment will show how much you've improved." : "Assign the post-assessment under Classwork to measure improvement."
  else if (!postRubric) status = you ? "Your tutor hasn't scored your post-test on the exam rubric yet." : "Score the post-test with the exam rubric under Submissions."
  else if (!comparison) status = "The pre- and post-tests were scored on different exams, so they can't be compared."

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-kez-blue">EXAM PROGRESS · {exam.name.toUpperCase()}</p>
          <p className="mt-1 text-xs text-slate-500">{goal ? describeGoal(goal) : "No exam goal set yet."}</p>
        </div>
        {comparison && (
          <button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-kez-blue-light px-4 py-2 text-sm font-bold text-kez-blue">
            <FileText size={16} aria-hidden="true" /> Progress report
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-kez-blue-light p-4">
          <p className="text-xs font-bold text-slate-500">Pre-test</p>
          <p className="mt-1 text-2xl font-extrabold">{formatExamScore(examId, preOverall)}</p>
        </div>
        <div className="rounded-2xl bg-kez-blue-light p-4">
          <p className="text-xs font-bold text-slate-500">Post-test</p>
          <p className="mt-1 text-2xl font-extrabold">{formatExamScore(examId, postOverall)}</p>
        </div>
        <div className="rounded-2xl bg-green-50 p-4">
          <p className="text-xs font-bold text-green-700">Change</p>
          <p className="mt-1 text-2xl font-extrabold text-green-800">{formatChange(comparison?.change ?? null)}</p>
        </div>
        <div className="rounded-2xl bg-kez-yellow-light p-4">
          <p className="text-xs font-bold text-amber-800">Target</p>
          <p className="mt-1 text-2xl font-extrabold">{formatExamScore(examId, target ?? null)}</p>
          <p className="text-xs text-amber-900">{gap === null ? "" : gap === 0 ? "Reached" : `${gap.toFixed(1)} to go`}</p>
        </div>
      </div>

      {status && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{status}</p>}
      {comparison && (
        <div className="mt-6">
          <div className="mb-3 flex gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-4 rounded-full bg-[var(--viz-neutral)]" />Pre-test</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-4 rounded-full bg-[var(--viz-bar)]" />Post-test</span>
          </div>
          <CriterionBars comparison={comparison} />
        </div>
      )}

      <p className="mt-5 text-[11px] leading-4 text-slate-400">
        {PRACTICE_ESTIMATE_NOTE} {TRADEMARK_NOTE}
      </p>

      {reportOpen && comparison && pre && post && (
        <ProgressReport
          learnerName={learnerName}
          goal={goal}
          comparison={comparison}
          pre={pre}
          post={post}
          submissions={submissions}
          onClose={() => setReportOpen(false)}
        />
      )}
    </section>
  )
}
