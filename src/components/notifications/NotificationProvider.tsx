import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { supabase } from "../../lib/supabase"
import {
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UNAVAILABLE_MESSAGE,
  safeNotificationDestination,
  type NotificationRole,
  type UserNotification,
} from "../../lib/notifications"

type NotificationContextValue = {
  notifications: UserNotification[]
  unreadCount: number | null
  loading: boolean
  error: string | null
  refresh: (notifyNew?: boolean) => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
  goToPage: (page: string, relatedId?: string | null) => void
  openNotification: (notification: UserNotification) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error("useNotifications must be used within NotificationProvider")
  return context
}

type Props = {
  userId: string
  role: NotificationRole
  onNavigate: (page: string, relatedId?: string | null) => void
  children: ReactNode
}

const mergeRecent = (current: UserNotification[], incoming: UserNotification[]) => {
  const byId = new Map(current.map((notification) => [notification.id, notification]))
  incoming.forEach((notification) => byId.set(notification.id, notification))
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100)
}

export default function NotificationProvider({ userId, role, onNavigate, children }: Props) {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<UserNotification | null>(null)
  const seenIds = useRef(new Set<string>())
  const snapshotReady = useRef(false)
  const navigateRef = useRef(onNavigate)
  navigateRef.current = onNavigate

  const refresh = useCallback(async (notifyNew = true) => {
    if (!userId) return
    try {
      const snapshot = await fetchNotifications(userId)
      const fresh = snapshot.notifications.filter((notification) => !seenIds.current.has(notification.id))
      fresh.forEach((notification) => {
        seenIds.current.add(notification.id)
      })
      if (notifyNew && snapshotReady.current && fresh[0]) setToast(fresh[0])
      snapshot.notifications.forEach((notification) => seenIds.current.add(notification.id))
      snapshotReady.current = true
      setNotifications((current) => mergeRecent(current, snapshot.notifications))
      setUnreadCount(snapshot.unreadCount)
      setError(null)
    } catch {
      setUnreadCount(null)
      setError(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setNotifications([])
    setUnreadCount(null)
    setLoading(Boolean(userId))
    setError(null)
    setToast(null)
    seenIds.current = new Set()
    snapshotReady.current = false
    if (!userId) return

    let active = true
    let initialLoaded = false
    let realtimeConnected = false
    let fallbackInterval: number | undefined
    let fallbackTimeout: number | undefined
    const buffered: UserNotification[] = []
    const beginFallback = () => {
      if (!active || fallbackInterval !== undefined) return
      fallbackInterval = window.setInterval(() => void refresh(true), 30_000)
    }
    const incoming = (notification: UserNotification, showToast: boolean) => {
      if (!active || notification.user_id !== userId || seenIds.current.has(notification.id)) return
      seenIds.current.add(notification.id)
      setNotifications((current) => mergeRecent(current, [notification]))
      if (!notification.read_at) setUnreadCount((count) => count === null ? null : count + 1)
      if (showToast) setToast(notification)
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = payload.new as UserNotification
          if (!initialLoaded) buffered.push(notification)
          else incoming(notification, true)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void refresh(false),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeConnected = true
          if (fallbackTimeout !== undefined) window.clearTimeout(fallbackTimeout)
          if (fallbackInterval !== undefined) window.clearInterval(fallbackInterval)
          fallbackInterval = undefined
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          realtimeConnected = false
          beginFallback()
        }
      })

    fallbackTimeout = window.setTimeout(() => {
      if (!realtimeConnected) beginFallback()
    }, 8_000)
    void (async () => {
      try {
        const snapshot = await fetchNotifications(userId)
        if (!active) return
        const ids = new Set(snapshot.notifications.map((notification) => notification.id))
        snapshot.notifications.forEach((notification) => seenIds.current.add(notification.id))
        let bufferedUnread = 0
        let bufferedNewest: UserNotification | null = null
        for (const notification of buffered) {
          if (ids.has(notification.id)) continue
          ids.add(notification.id)
          seenIds.current.add(notification.id)
          if (!bufferedNewest || notification.created_at > bufferedNewest.created_at) bufferedNewest = notification
          snapshot.notifications.unshift(notification)
          if (!notification.read_at) bufferedUnread += 1
        }
        setNotifications(mergeRecent([], snapshot.notifications))
        setUnreadCount(snapshot.unreadCount + bufferedUnread)
        setError(null)
        snapshotReady.current = true
        if (bufferedNewest) setToast(bufferedNewest)
      } catch {
        if (active) {
          setUnreadCount(null)
          setError(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
        }
      } finally {
        if (active) {
          initialLoaded = true
          setLoading(false)
          buffered.length = 0
        }
      }
    })()

    return () => {
      active = false
      if (fallbackTimeout !== undefined) window.clearTimeout(fallbackTimeout)
      if (fallbackInterval !== undefined) window.clearInterval(fallbackInterval)
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 8_000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const markRead = useCallback(async (notificationId: string) => {
    const notification = notifications.find((item) => item.id === notificationId)
    if (!notification || notification.read_at) return
    try {
      await markNotificationRead(userId, notificationId)
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read_at: readAt } : item))
      setUnreadCount((count) => count === null ? null : Math.max(0, count - 1))
      setError(null)
    } catch {
      setError(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
    }
  }, [notifications, userId])

  const markAllRead = useCallback(async () => {
    if (!userId || unreadCount === 0) return
    try {
      await markAllNotificationsRead(userId)
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }))
      setUnreadCount(0)
      setError(null)
    } catch {
      setError(NOTIFICATIONS_UNAVAILABLE_MESSAGE)
    }
  }, [unreadCount, userId])

  const openNotification = useCallback((notification: UserNotification) => {
    void markRead(notification.id)
    const destination = safeNotificationDestination(role, notification.destination)
    navigateRef.current(destination, notification.related_id)
    setToast(null)
  }, [markRead, role])

  const goToPage = useCallback((page: string, relatedId?: string | null) => {
    navigateRef.current(safeNotificationDestination(role, page), relatedId)
    setToast(null)
  }, [role])

  const value = { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, goToPage, openNotification }
  return (
    <NotificationContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <button onClick={() => openNotification(toast)} className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-extrabold text-kez-dark">{toast.title}</span>
              <span className="mt-1 block line-clamp-2 text-sm text-slate-600">{toast.body}</span>
              <span className="mt-2 block text-xs text-slate-400">{formatNotificationTime(toast.created_at)}</span>
            </button>
            <button onClick={() => setToast(null)} type="button" aria-label="Dismiss notification" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}
