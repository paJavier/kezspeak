import { Check, CheckCheck, Inbox } from "lucide-react"
import { useEffect, useState } from "react"
import { formatNotificationTime } from "../../lib/notifications"
import { useNotifications } from "./NotificationProvider"
import AnnouncementsPage from "./AnnouncementsPage"
import type { NotificationRole } from "../../lib/notifications"

type Filter = "all" | "unread" | "announcements" | "assessments" | "scores" | "submissions" | "requests"

type Props = {
  userId: string
  role: NotificationRole
  selectedAnnouncementId?: string | null
}

const roleFilters: Record<NotificationRole, Filter[]> = {
  student: ["all", "unread", "announcements", "assessments", "scores"],
  tutor: ["all", "unread", "announcements", "submissions", "requests"],
  admin: ["all", "unread", "announcements", "assessments", "scores", "submissions", "requests"],
  super_admin: ["all", "unread", "announcements", "assessments", "scores", "submissions", "requests"],
}

const filterLabels: Record<Filter, string> = {
  all: "All",
  unread: "Unread",
  announcements: "Announcements",
  assessments: "Assessments",
  scores: "Scores & Feedback",
  submissions: "Submissions",
  requests: "Requests",
}

const matchesFilter = (filter: Filter, type: string) => {
  if (filter === "all") return true
  if (filter === "unread") return true
  if (filter === "announcements") return type === "announcement"
  if (filter === "assessments") return type === "assessment_available"
  if (filter === "scores") return type === "score_released" || type === "feedback_published"
  if (filter === "submissions") return type === "review_required"
  return type === "access_request" || type === "admin_request"
}

export default function NotificationsPage({ userId, role, selectedAnnouncementId }: Props) {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, openNotification } = useNotifications()
  const [filter, setFilter] = useState<Filter>(selectedAnnouncementId ? "announcements" : "all")
  const filters = roleFilters[role]
  useEffect(() => {
    if (selectedAnnouncementId) setFilter("announcements")
  }, [selectedAnnouncementId])
  const visible = notifications.filter((notification) =>
    matchesFilter(filter, notification.type) && (filter !== "unread" || !notification.read_at),
  )

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-kez-dark">Your notifications</h2>
          <p className="mt-1 text-sm text-slate-500">Recent updates for your KezSpeak account.</p>
        </div>
        <button type="button" onClick={() => void markAllRead()} disabled={unreadCount === null || unreadCount === 0} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-kez-blue shadow-sm disabled:opacity-40">
          <CheckCheck size={16} aria-hidden="true" /> Mark all as read
        </button>
      </div>

      <div className="mb-4 flex gap-2" role="group" aria-label="Filter notifications">
        {filters.map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-kez-blue text-white" : "bg-white text-slate-600"}`}>
            {filterLabels[value]}{value === "unread" && unreadCount !== null ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {filter === "announcements" && <AnnouncementsPage userId={userId} role={role} selectedAnnouncementId={selectedAnnouncementId} />}

      {filter !== "announcements" && loading && <p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading notifications…</p>}
      {filter !== "announcements" && !loading && error && (
        <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh(false)} className="mt-2 font-bold text-kez-blue">Try again</button>
        </div>
      )}
      {filter !== "announcements" && !loading && !error && visible.length === 0 && (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <Inbox className="mx-auto text-slate-300" size={34} aria-hidden="true" />
          <p className="mt-3 font-bold text-kez-dark">{filter === "unread" ? "No unread notifications" : "No notifications in this category"}</p>
          <p className="mt-1 text-sm text-slate-500">New updates will appear here.</p>
        </div>
      )}
      {filter !== "announcements" && !loading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {visible.map((notification) => (
            <article key={notification.id} className={`flex items-start gap-3 border-b border-slate-100 p-4 last:border-0 sm:p-5 ${notification.read_at ? "" : "bg-blue-50/50"}`}>
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-slate-200" : "bg-kez-blue"}`} aria-label={notification.read_at ? "Read" : "Unread"} />
              <button type="button" onClick={() => openNotification(notification)} className="min-w-0 flex-1 text-left">
                <span className="block font-bold text-kez-dark">{notification.title}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">{notification.body}</span>
                <time className="mt-2 block text-xs text-slate-400" dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time>
              </button>
              {!notification.read_at && (
                <button type="button" onClick={() => void markRead(notification.id)} aria-label={`Mark ${notification.title} as read`} className="rounded-xl p-2 text-slate-400 hover:bg-blue-50 hover:text-kez-blue">
                  <Check size={17} aria-hidden="true" />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
