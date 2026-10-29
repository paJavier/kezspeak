import { callMlService, type AssessmentTask } from "./assessments"
import { supabase } from "./supabase"

export type Role = "student" | "tutor" | "admin" | "super_admin"

// Display names only. The database keeps the role values (admin, super_admin).
export const roleLabels: Record<Role, string> = {
  student: "Student",
  tutor: "Tutor / Teacher",
  admin: "Moderator",
  super_admin: "Administrator",
}

export type ManagedUser = {
  id: string
  full_name: string
  email: string
  role: Role
  created_at: string | null
}

// Account management needs the service-role key, so it goes through
// ml-service (/admin/*), which checks the caller is a super admin.
const UNREACHABLE = "The KezSpeak server (ml-service) is not reachable, so accounts can't be managed right now."

export const listUsers = () => callMlService<ManagedUser[]>("/admin/users", { method: "GET", unreachable: UNREACHABLE })

// Email links (invites, password resets) come back to this app.
const appOrigin = () => window.location.origin

/** Without a password, Supabase emails an invite and the user picks their own password. */
export const createUser = (user: { email: string; full_name: string; password?: string; role: Role }) =>
  callMlService<ManagedUser>("/admin/users", {
    method: "POST",
    body: { ...user, password: user.password || undefined, redirect_to: appOrigin() },
    unreachable: UNREACHABLE,
  })

/** Emails the user a link to set a new password (also works as "resend invite"). */
export const sendPasswordEmail = (id: string) =>
  callMlService<{ sent_to: string }>(`/admin/users/${id}/password-email`, {
    method: "POST",
    body: { redirect_to: appOrigin() },
    unreachable: UNREACHABLE,
  })

export const updateUser = (id: string, changes: { full_name?: string; role?: Role; password?: string }) =>
  callMlService<ManagedUser>(`/admin/users/${id}`, { method: "PATCH", body: changes, unreachable: UNREACHABLE })

export const deleteUser = (id: string) =>
  callMlService<null>(`/admin/users/${id}`, { method: "DELETE", unreachable: UNREACHABLE })

// Tasks and assignments go straight to Supabase; RLS allows admins to write.

export type TaskInput = Omit<AssessmentTask, "id">

/** New tasks record their creator; tutors may only change their own practice tasks (RLS). */
export async function saveTask(task: TaskInput, id?: string, createdBy?: string): Promise<void> {
  // Only real task columns; never rewrite created_by on update. The exam fields
  // are sent only when set, so saving still works before 20261104_exam_goals.sql.
  const fields = {
    title: task.title,
    prompt: task.prompt,
    skill_focus: task.skill_focus,
    kind: task.kind,
    duration_seconds: task.duration_seconds,
    ...(task.exam_style || task.prep_seconds ? { exam_style: task.exam_style ?? null, prep_seconds: task.prep_seconds ?? 0 } : {}),
  }
  const { error } = id
    ? await supabase.from("assessment_tasks").update(fields).eq("id", id)
    : await supabase.from("assessment_tasks").insert({ ...fields, created_by: createdBy ?? null })
  if (error) {
    if (error.code === "42501") throw new Error("You can only change practice tasks you created.")
    throw new Error(`Could not save the task: ${error.message}`)
  }
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("assessment_tasks").delete().eq("id", id)
  if (error) {
    // submissions.task_id is ON DELETE RESTRICT to protect recorded data.
    if (error.code === "23503") throw new Error("This task already has recordings, so it can't be deleted.")
    throw new Error(`Could not delete the task: ${error.message}`)
  }
}

/** AI-drafted speaking task from reference material. Nothing is stored; the tutor edits it first. */
export type ActivityDraft = {
  provider: string
  model: string
  title: string
  prompt: string
  follow_up_questions: string[]
  skill_focus: string
  duration_seconds: number
}

export function generateActivityDraft(file: File, skillFocus?: string, examStyle?: string | null): Promise<ActivityDraft> {
  const form = new FormData()
  form.append("file", file)
  if (skillFocus?.trim()) form.append("skill_focus", skillFocus.trim())
  if (examStyle) form.append("exam_style", examStyle)
  return callMlService<ActivityDraft>("/activities/generate", {
    body: form,
    unreachable: "The KezSpeak server (ml-service) is not reachable, so activities can't be drafted right now.",
  }).catch((err: Error) => {
    // FastAPI's bare 404: the running ml-service predates this endpoint.
    if (err.message === "Not Found") throw new Error("The KezSpeak server is out of date. Restart ml-service to enable AI drafts.")
    throw err
  })
}

const FOLLOW_UP_HEADING = "Also answer:"

/** Folds follow-up questions into the learner prompt; tasks have no separate column for them. */
export function draftPrompt(prompt: string, followUps: string[]): string {
  const questions = followUps.map((q) => q.trim()).filter(Boolean)
  if (!questions.length) return prompt.trim()
  return `${prompt.trim()}\n\n${FOLLOW_UP_HEADING}\n${questions.map((q) => `- ${q}`).join("\n")}`
}

/** Inverse of draftPrompt: splits a trailing "Also answer:" list back into questions. */
export function splitPrompt(full: string): { prompt: string; followUps: string[] } {
  const marker = `\n\n${FOLLOW_UP_HEADING}\n`
  const at = full.lastIndexOf(marker)
  if (at === -1) return { prompt: full, followUps: [] }
  const lines = full.slice(at + marker.length).split("\n")
  // Only a block made entirely of "- " lines is ours; otherwise leave the text alone.
  if (!lines.length || !lines.every((line) => line.startsWith("- "))) return { prompt: full, followUps: [] }
  return { prompt: full.slice(0, at), followUps: lines.map((line) => line.slice(2).trim()) }
}

// Assignments and rosters live in lib/classroom.ts.
