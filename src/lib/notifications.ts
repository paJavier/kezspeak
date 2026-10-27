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
  tutor: new Set(["review", "submissions", "learners", "announcements", "notifications", "profile"]),
  admin: new Set(["announcements", "notifications", "profile"]),
  super_admin: new Set(["announcements", "notifications", "assignments", "users", "tasks", "profile"]),
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

