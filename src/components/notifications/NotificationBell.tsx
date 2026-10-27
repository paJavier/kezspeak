import { useEffect, useRef, useState } from "react"
import { Bell, Check, CheckCheck } from "lucide-react"
import { formatNotificationTime } from "../../lib/notifications"
import { useNotifications } from "./NotificationProvider"

export default function NotificationBell() {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, goToPage, openNotification } = useNotifications()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("pointerdown", closeOutside)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("pointerdown", closeOutside)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [open])

  const badge = unreadCount !== null && unreadCount > 99 ? "99+" : unreadCount

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full bg-kez-blue-light text-kez-blue transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kez-blue"
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount !== null && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-extrabold leading-5 text-white" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <section role="dialog" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="font-extrabold text-kez-dark">Notifications</h2>
              <p className="text-xs text-slate-500">{unreadCount === null ? "Count unavailable" : `${unreadCount} unread`}</p>
            </div>
            <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-kez-blue hover:bg-kez-blue-light disabled:opacity-40">
              <CheckCheck size={15} aria-hidden="true" /> Mark all read
            </button>
          </header>
          <div className="max-h-[min(65vh,28rem)] overflow-y-auto">
            {loading && <p role="status" className="p-5 text-sm text-slate-500">Loading notifications…</p>}
            {!loading && error && (
              <div className="p-5 text-sm text-red-700">
                <p>{error}</p>
                <button type="button" onClick={() => void refresh(false)} className="mt-2 font-bold text-kez-blue">Try again</button>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && <p className="p-5 text-sm text-slate-500">You’re all caught up.</p>}
            {!loading && !error && notifications.slice(0, 8).map((notification) => (
              <article key={notification.id} className={`flex gap-2 border-b border-slate-100 p-3 last:border-0 ${notification.read_at ? "bg-white" : "bg-blue-50/70"}`}>
                <button type="button" onClick={() => { openNotification(notification); setOpen(false) }} className="min-w-0 flex-1 text-left">
                  <span className="flex items-start gap-2">
                    {!notification.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-kez-blue" aria-label="Unread" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-kez-dark">{notification.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-600">{notification.body}</span>
                      <time className="mt-1 block text-[11px] text-slate-400" dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time>
                    </span>
                  </span>
                </button>
                {!notification.read_at && (
                  <button type="button" onClick={() => void markRead(notification.id)} aria-label={`Mark ${notification.title} as read`} className="h-8 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-kez-blue">
                    <Check size={15} aria-hidden="true" />
                  </button>
                )}
              </article>
            ))}
          </div>
          <footer className="border-t border-slate-100 p-3 text-center">
            <button type="button" onClick={() => { goToPage("notifications"); setOpen(false) }} className="text-sm font-bold text-kez-blue hover:underline">
              View all notifications
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}
