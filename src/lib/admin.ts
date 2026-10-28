import { callMlService, type AssessmentTask } from "./assessments"
import { supabase } from "./supabase"

export type Role = "student" | "tutor" | "admin" | "super_admin"

// Display names only. The database keeps the role values (admin, super_admin).
export const roleLabels: Record<Role, string> = {
  student: "Student",
  tutor: "Tutor / Teacher",
  admin: "Staff",
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
  // Never rewrite created_by on update.
  const { created_by: _ignored, ...fields } = task
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

// Assignments and rosters live in lib/classroom.ts.
