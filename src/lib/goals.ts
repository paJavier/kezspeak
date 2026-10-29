import type { CambridgeLevel, ExamId } from "./exams"
import { supabase } from "./supabase"

/** A learner's exam goal (migration 20261104_exam_goals.sql). */
export type LearnerGoal = {
  learner_id: string
  exam: ExamId
  cambridge_level: CambridgeLevel | null
  target_score: number | null
  exam_date: string | null
  updated_at?: string
}

const NOT_SET_UP = "Exam goals aren't set up yet: apply supabase/migrations/20261104_exam_goals.sql."
const missingTable = (message: string) => /learner_goals/.test(message) && /(does not exist|schema cache|relation)/i.test(message)

/** The goal, or null when none is set. Readable by the learner, their tutor and admins (RLS). */
export async function fetchGoal(learnerId: string): Promise<LearnerGoal | null> {
  const { data, error } = await supabase
    .from("learner_goals")
    .select("learner_id, exam, cambridge_level, target_score, exam_date, updated_at")
    .eq("learner_id", learnerId)
    .maybeSingle()
  if (error) throw new Error(missingTable(error.message) ? NOT_SET_UP : `Could not load the exam goal: ${error.message}`)
  return (data as LearnerGoal | null) ?? null
}

/** Every goal the user may see: their students' for tutors, all for admins (RLS). */
export async function listGoals(): Promise<LearnerGoal[]> {
  const { data, error } = await supabase.from("learner_goals").select("learner_id, exam, cambridge_level, target_score, exam_date")
  if (error) throw new Error(missingTable(error.message) ? NOT_SET_UP : `Could not load exam goals: ${error.message}`)
  return (data ?? []) as LearnerGoal[]
}

export async function saveGoal(goal: LearnerGoal): Promise<void> {
  const { error } = await supabase.from("learner_goals").upsert(
    {
      learner_id: goal.learner_id,
      exam: goal.exam,
      cambridge_level: goal.exam === "cambridge" ? goal.cambridge_level : null,
      target_score: goal.target_score,
      exam_date: goal.exam_date || null,
    },
    { onConflict: "learner_id" },
  )
  if (error) {
    if (missingTable(error.message)) throw new Error(NOT_SET_UP)
    if (error.code === "42501") throw new Error("You can only set goals for yourself or your own students.")
    throw new Error(`Could not save the exam goal: ${error.message}`)
  }
}
