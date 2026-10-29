import { supabase } from "./supabase"

export const NOTIFICATIONS_UNAVAILABLE_MESSAGE = "Notifications are temporarily unavailable. Please try again."

export type NotificationRole = "student" | "tutor" | "admin" | "super_admin"

export type UserNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  related_id: string | null
  destination: string
  created_at: string
  read_at: string | null
}

const roleDestinations: Record<NotificationRole, ReadonlySet<string>> = {
  student: new Set(["activities", "assessment", "results", "feedback", "announcements", "notifications", "profile"]),
  tutor: new Set(["review", "submissions", "learners", "classwork", "tasks", "announcements", "notifications", "profile"]),
  admin: new Set(["review", "submissions", "learners", "announcements", "notifications", "classwork", "tasks", "profile"]),
  super_admin: new Set(["review", "submissions", "learners", "announcements", "notifications", "classwork", "users", "tasks", "profile"]),
}

export type AnnouncementAudience = "everyone" | "students" | "tutors"

/**
 * Who a role may address. Administrators and moderators pick any audience; a
 * tutor's announcement only reaches their own students (enforced by RLS and
 * notify_published_announcement, migration 20261102_announcement_audience.sql).
 */
export function audienceOptions(role: NotificationRole): AnnouncementAudience[] {
  if (role === "admin" || role === "super_admin") return ["everyone", "students", "tutors"]
  if (role === "tutor") return ["students"]
  return []
}

export function audienceLabel(audience: AnnouncementAudience, authorRole: NotificationRole): string {
  if (authorRole === "tutor") return "My students"
  return { everyone: "Everyone", students: "All students", tutors: "All tutors & staff" }[audience]
}

export type NotificationFilter = "all" | "unread" | "announcements" | "assessments" | "scores" | "submissions"

/**
 * Filters each role can actually use. Staff only ever receive announcements
 * and submission reviews (see the notify_* triggers); the assessment and
 * score filters are for students.
 */
export function notificationFilters(role: NotificationRole): NotificationFilter[] {
  return role === "student"
    ? ["all", "unread", "announcements", "assessments", "scores"]
    : ["all", "unread", "announcements", "submissions"]
}

export function matchesNotificationFilter(filter: NotificationFilter, type: string): boolean {
  if (filter === "all" || filter === "unread") return true
  if (filter === "announcements") return type === "announcement"
  if (filter === "assessments") return type === "assessment_available"
  if (filter === "scores") return type === "score_released" || type === "feedback_published" || type === "assignment_graded"
  return type === "review_required"
}

/** Notification rows contain only internal page keys; arbitrary URLs are rejected. */
export function safeNotificationDestination(role: NotificationRole, destination: string): string {
  return roleDestinations[role].has(destination) ? destination : "notifications"
}

export async function fetchNotifications(userId: string, limit = 100) {
  const [listResult, countResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,user_id,type,title,body,related_id,destination,created_at,read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ])
  if (listResult.error || countResult.error || countResult.count === null) {
    throw new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
  }
  return {
    notifications: (listResult.data ?? []) as UserNotification[],
    unreadCount: countResult.count,
  }
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
}

export const formatNotificationTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))

