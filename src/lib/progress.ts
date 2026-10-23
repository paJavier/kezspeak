import { comparePrePost, finalScore, isProcessing, type AssessmentTask, type PrePostComparison, type Submission, type TaskKind } from "./assessments"

export const greeting = (date = new Date()) => {
  const hour = date.getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

export const formatScore = (score: number | null | undefined) => (score === null || score === undefined ? "—" : Math.round(score).toString())

export const formatChange = (change: number | null) =>
  change === null ? "—" : `${change > 0 ? "+" : ""}${Math.round(change * 10) / 10}`

export const needsReview = (s: Submission) => s.status === "completed" && !!s.evaluation && !s.feedback

/** Where a learner is on Assess → Practice → Reassess → Measure. */
export type Journey = {
  comparison: PrePostComparison
  preScore: number | null
  postScore: number | null
  practiceCount: number
  latest: Submission | null
  latestFeedback: Submission | null
  /** 1 = take pre-assessment, 2 = practice, 3 = take post-assessment, 4 = improvement measured. */
  stage: 1 | 2 | 3 | 4
}

export function learnerJourney(submissions: Submission[]): Journey {
  const comparison = comparePrePost(submissions)
  const completed = submissions.filter((s) => s.status === "completed" && s.evaluation)
  const practiceCount = completed.filter((s) => s.task?.kind === "practice").length
  const stage = comparison.post ? 4 : comparison.pre ? (practiceCount > 0 ? 3 : 2) : 1
  return {
    comparison,
    preScore: comparison.pre ? finalScore(comparison.pre) : null,
    postScore: comparison.post ? finalScore(comparison.post) : null,
    practiceCount,
    latest: completed[0] ?? null,
    latestFeedback: submissions.find((s) => s.feedback) ?? null,
    stage,
  }
}

export type LearnerStatus = "Needs review" | "Processing" | "Improving" | "Needs attention" | "No change" | "Pre-assessment done" | "Not assessed yet"

export type LearnerSummary = {
  learnerId: string
  name: string
  journey: Journey
  submissions: Submission[]
  lastActivity: string | null
  status: LearnerStatus
}

/** One row per learner from the submissions the current tutor/admin can see. */
export function summarizeLearners(submissions: Submission[]): LearnerSummary[] {
  const byLearner = new Map<string, Submission[]>()
  for (const s of submissions) byLearner.set(s.learner_id, [...(byLearner.get(s.learner_id) ?? []), s])

  return [...byLearner.entries()]
    .map(([learnerId, list]) => {
      const journey = learnerJourney(list)
      const change = journey.comparison.scoreChange
      const status: LearnerStatus = list.some(needsReview)
        ? "Needs review"
        : list.some((s) => isProcessing(s.status))
          ? "Processing"
          : change !== null
            ? change > 0
              ? "Improving"
              : change < 0
                ? "Needs attention"
                : "No change"
            : journey.comparison.pre
              ? "Pre-assessment done"
              : "Not assessed yet"
      return {
        learnerId,
        name: list[0].learner_name ?? "Learner",
        journey,
        submissions: list,
        lastActivity: list[0]?.submitted_at ?? null,
        status,
      }
    })
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
}

export const statusStyles: Record<LearnerStatus, string> = {
  "Needs review": "bg-amber-100 text-amber-700",
  Processing: "bg-slate-100 text-slate-600",
  Improving: "bg-green-50 text-green-700",
  "Needs attention": "bg-red-50 text-red-700",
  "No change": "bg-slate-100 text-slate-600",
  "Pre-assessment done": "bg-kez-blue-light text-kez-blue",
  "Not assessed yet": "bg-slate-100 text-slate-500",
}

export const relativeDate = (iso: string | null) => {
  if (!iso) return "—"
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
  if (days === 1) return "Yesterday"
  return date.toLocaleDateString()
}

export const JOURNEY_STEPS = ["Pre-Assessment", "Practice", "Post-Assessment", "Improvement"] as const

/** The task a learner should do next for their current journey stage. */
export const nextTaskFor = (journey: Journey, tasks: AssessmentTask[]): AssessmentTask | null => {
  const kind: TaskKind = journey.stage === 1 ? "pre" : journey.stage === 3 ? "post" : "practice"
  return tasks.find((t) => t.kind === kind) ?? tasks.find((t) => t.kind === "practice") ?? null
}

export const stepStatus = (journey: Journey, index: number) => {
  const step = index + 1
  if (step < journey.stage || (step === 4 && journey.stage === 4)) return "Completed"
  if (step === journey.stage) return "Up next"
  return "Later"
}
