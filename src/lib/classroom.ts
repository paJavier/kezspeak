import { supabase } from "./supabase"
import { finalScore, type Submission, type TaskKind } from "./assessments"

// Classwork (migration 20261028_classwork.sql): admins put learners on a
// tutor's roster; tutors assign tasks with deadlines and give a class grade.
// The grade is separate from the machine score and the pre/post comparison.

// created_at needs migration 20261029_statistics.sql; it is undefined before that.
export type Person = { id: string; full_name: string; email: string | null; role: string; created_at?: string | null }

export type AssignmentStatus = "assigned" | "submitted" | "reviewed" | "missing" | "graded"

export type Assignment = {
  id: string
  task_id: string
  learner_id: string
  tutor_id: string
  due_at: string | null
  status: AssignmentStatus
  grade: number | null
  graded_at: string | null
  created_at: string
  task: { title: string; kind: TaskKind; prompt: string } | null
}

export type RosterLink = { tutor_id: string; learner_id: string }

const MIGRATION_HINT = "Apply supabase/migrations/20261028_classwork.sql in the Supabase SQL editor."

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await supabase.rpc("kez_list_people")
  if (error) throw new Error(`Could not load people: ${error.message}. ${MIGRATION_HINT}`)
  return (data ?? []) as Person[]
}

export async function listRoster(): Promise<RosterLink[]> {
  const { data, error } = await supabase.from("tutor_learners").select("tutor_id, learner_id")
  if (error) throw new Error(`Could not load rosters: ${error.message}. ${MIGRATION_HINT}`)
  return data ?? []
}

/**
 * The signed-in student's tutor, or null when none is set yet. Students only
 * get tasks and classwork once they have one (migration 20261103_require_tutor.sql).
 */
export async function fetchMyTutorId(learnerId: string): Promise<string | null> {
  const { data, error } = await supabase.from("tutor_learners").select("tutor_id").eq("learner_id", learnerId).limit(1)
  if (error) throw new Error(`Could not check your tutor: ${error.message}`)
  return data?.[0]?.tutor_id ?? null
}

/** The signed-in student's tutor (name only; kez_list_people hides tutor emails from learners), or null. */
export async function fetchMyTutor(learnerId: string): Promise<Person | null> {
  const tutorId = await fetchMyTutorId(learnerId)
  if (!tutorId) return null
  const people = await listPeople()
  return people.find((p) => p.id === tutorId) ?? null
}

/** A student's tutor (one per student; the roster table allows more, the UI doesn't). */
export const tutorOf = (roster: RosterLink[], learnerId: string) => roster.find((r) => r.learner_id === learnerId)?.tutor_id ?? null

/** Admin only. Pass null to clear. Open and past assignments move to the new tutor. */
export async function setLearnerTutor(learnerId: string, tutorId: string | null): Promise<void> {
  const { error } = await supabase.rpc("kez_set_learner_tutor", { p_learner: learnerId, p_tutor: tutorId })
  if (error) {
    if (/kez_set_learner_tutor/.test(error.message)) {
      throw new Error("Apply supabase/migrations/20261030_simplify.sql in the Supabase SQL editor.")
    }
    throw new Error(`Could not change the tutor: ${error.message}`)
  }
}

/** Assignments visible to the caller (RLS). Overdue unsubmitted work is closed first. */
export async function listAssignments(): Promise<Assignment[]> {
  // Best effort: if this fails the UI still derives "missing" from due_at.
  await supabase.rpc("kez_mark_missing_assignments")
  const { data, error } = await supabase
    .from("assignments")
    .select("*, task:assessment_tasks(title, kind, prompt)")
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Could not load assignments: ${error.message}`)
  return (data ?? []).map((row) => ({ ...row, task: Array.isArray(row.task) ? (row.task[0] ?? null) : row.task }))
}

/**
 * Assign one task to several learners, each owned by their own tutor (or the
 * assigning admin when they have none). Learners who already have it are skipped.
 */
export async function assignTask(input: {
  task_id: string
  learners: { learner_id: string; tutor_id: string }[]
  due_at: string | null
}): Promise<{ created: number; skipped: number }> {
  // One insert per learner: the database refuses a second pre/post, or a second
  // open copy of a practice task (assignments_guard), and that learner is skipped.
  let created = 0
  let skipped = 0
  for (const l of input.learners) {
    const { error } = await supabase.from("assignments").insert({ task_id: input.task_id, due_at: input.due_at, ...l })
    if (!error) created += 1
    else if (error.code === "23505") skipped += 1
    else if (error.code === "42501") throw new Error("You can only assign work to your own students.")
    else throw new Error(`Could not assign the task: ${error.message}`)
  }
  return { created, skipped }
}

/** Open = can still be recorded: not graded/missing and before the due date (matches the DB trigger). */
export const isOpenAssignment = (a: Assignment) =>
  ["assigned", "submitted", "reviewed"].includes(a.status) && !isOverdue(a)

export async function updateDueDate(id: string, dueAt: string | null): Promise<void> {
  // Moving the deadline later reopens work that was closed as missing.
  const reopen = dueAt === null || new Date(dueAt) > new Date()
  const { error } = await supabase.from("assignments").update({ due_at: dueAt }).eq("id", id)
  if (error) throw new Error(`Could not change the due date: ${error.message}`)
  if (reopen) {
    const { error: reopenError } = await supabase
      .from("assignments")
      .update({ status: "assigned", grade: null })
      .eq("id", id)
      .eq("status", "missing")
    if (reopenError) throw new Error(`Could not reopen the assignment: ${reopenError.message}`)
  }
}

export async function gradeAssignment(id: string, grade: number): Promise<void> {
  const { error } = await supabase.from("assignments").update({ grade, status: "graded" }).eq("id", id)
  if (error) throw new Error(`Could not save the grade: ${error.message}`)
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("assignments").delete().eq("id", id)
  if (error) throw new Error(`Could not remove the assignment: ${error.message}`)
}

export const isOverdue = (a: Assignment) => !!a.due_at && new Date(a.due_at).getTime() < Date.now()

/** Display state, treating overdue unsubmitted work as missing even before the DB closes it. */
export type ClassworkState = "todo" | "turned_in" | "missing" | "graded"

export function classworkState(a: Assignment): ClassworkState {
  if (a.status === "graded") return "graded"
  if (a.status === "missing" || (a.status === "assigned" && isOverdue(a))) return "missing"
  if (a.status === "assigned") return "todo"
  return "turned_in"
}

export const stateLabels: Record<ClassworkState, string> = {
  todo: "Assigned",
  turned_in: "Turned in",
  missing: "Missing",
  graded: "Graded",
}

export const stateStyles: Record<ClassworkState, string> = {
  todo: "bg-blue-50 text-kez-blue",
  turned_in: "bg-amber-50 text-amber-800",
  missing: "bg-red-50 text-red-700",
  graded: "bg-green-50 text-green-700",
}

/** Grade shown to people: missing work counts as 0 until a tutor changes it. */
export const displayGrade = (a: Assignment): number | null =>
  a.grade ?? (classworkState(a) === "missing" ? 0 : null)

/** Latest recording turned in for an assignment. */
export const latestSubmissionFor = (a: Assignment, submissions: Submission[] | null) =>
  submissions
    ?.filter((s) => s.assignment_id === a.id)
    .sort((x, y) => y.submitted_at.localeCompare(x.submitted_at))[0] ?? null

/** Suggested grade for the tutor: their adjusted score, else the machine estimate. */
export const suggestedGrade = (submission: Submission | null) => {
  const score = submission ? finalScore(submission) : null
  return score === null ? null : Math.round(score)
}

export const formatDue = (value: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No due date"
