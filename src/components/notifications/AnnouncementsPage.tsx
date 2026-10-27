import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Check, Megaphone, Send } from "lucide-react"
import { supabase } from "../../lib/supabase"
import type { NotificationRole } from "../../lib/notifications"
import { formatNotificationTime } from "../../lib/notifications"
import { useNotifications } from "./NotificationProvider"

type Announcement = {
  id: string
  title: string
  body: string
  author_id: string
  published_at: string
  author: { full_name: string } | { full_name: string }[] | null
}

type Props = {
  userId: string
  role: NotificationRole
  selectedAnnouncementId?: string | null
}

const authorName = (author: Announcement["author"]) =>
  (Array.isArray(author) ? author[0] : author)?.full_name ?? "KezSpeak tutor"

export default function AnnouncementsPage({ userId, role, selectedAnnouncementId }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [readIds, setReadIds] = useState(new Set<string>())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", body: "" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [version, setVersion] = useState(0)
  const { notifications, markRead } = useNotifications()
  const canPublish = role === "admin" || role === "super_admin"

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      const announcementsResult = await supabase
        .from("announcements")
        .select("id,title,body,author_id,published_at,author:profiles!announcements_author_id_fkey(full_name)")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
      if (!active) return
      if (announcementsResult.error) {
        setError(announcementsResult.error.message)
        setLoading(false)
        return
      }

      let nextReadIds = new Set<string>()
      if (role === "student") {
        const readsResult = await supabase
          .from("announcement_recipients")
          .select("announcement_id,read_at")
          .eq("user_id", userId)
        if (!active) return
        if (readsResult.error) {
          setError(readsResult.error.message)
          setLoading(false)
          return
        }
        nextReadIds = new Set((readsResult.data ?? []).filter((row) => row.read_at).map((row) => row.announcement_id))
      }

      setAnnouncements((announcementsResult.data ?? []) as Announcement[])
      setReadIds(nextReadIds)
      setError(null)
      setLoading(false)
    })().catch((err) => {
      if (!active) return
      setError((err as Error).message || "Announcements could not be loaded.")
      setLoading(false)
    })
    return () => { active = false }
  }, [role, userId, version])

  useEffect(() => {
    if (!selectedAnnouncementId || loading) return
    document.getElementById(`announcement-${selectedAnnouncementId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [loading, selectedAnnouncementId, announcements])

  const announcementNotifications = useMemo(() => new Map(
    notifications.filter((notification) => notification.type === "announcement" && notification.related_id)
      .map((notification) => [notification.related_id as string, notification.id]),
  ), [notifications])

  const publish = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || !userId) return
    setSaving(true)
    setMessage("")
    setError(null)
    try {
      const { error: publishError } = await supabase.from("announcements").insert({
        author_id: userId,
        title: form.title.trim(),
        body: form.body.trim(),
        published_at: new Date().toISOString(),
      })
      if (publishError) throw new Error(publishError.message)
      setForm({ title: "", body: "" })
      setMessage("Announcement published to all students.")
      setVersion((value) => value + 1)
    } catch (err) {
      setError((err as Error).message || "The announcement could not be published.")
    } finally {
      setSaving(false)
    }
  }

  const markAnnouncementRead = async (announcementId: string) => {
    if (readIds.has(announcementId)) return
    const { error: updateError } = await supabase
      .from("announcement_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("announcement_id", announcementId)
      .eq("user_id", userId)
      .is("read_at", null)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setReadIds((current) => new Set(current).add(announcementId))
    const notificationId = announcementNotifications.get(announcementId)
    if (notificationId) void markRead(notificationId)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {canPublish && (
        <form onSubmit={publish} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-kez-blue-light text-kez-blue"><Megaphone size={20} /></span>
            <div>
              <h2 className="font-extrabold text-kez-dark">Share an announcement</h2>
              <p className="text-sm text-slate-500">It will be shared with all students.</p>
            </div>
          </div>
          <input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Announcement title" className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-kez-blue" />
          <textarea required maxLength={4000} rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write an update for your students…" className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-kez-blue" />
          <button type="submit" disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            <Send size={16} aria-hidden="true" /> {saving ? "Publishing…" : "Publish announcement"}
          </button>
          {message && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
        </form>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-extrabold text-kez-dark">Announcements</h2>
          <p className="mt-1 text-sm text-slate-500">Updates shared with your KezSpeak community.</p>
        </div>
        {loading && <p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading announcements…</p>}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => setVersion((value) => value + 1)} className="mt-2 font-bold text-kez-blue">Try again</button>
          </div>
        )}
        {!loading && !error && announcements.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <Megaphone className="mx-auto text-slate-300" size={34} aria-hidden="true" />
            <p className="mt-3 font-bold text-kez-dark">No announcements yet</p>
            <p className="mt-1 text-sm text-slate-500">Published updates will show here.</p>
          </div>
        )}
        {!loading && !error && announcements.length > 0 && (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const isRead = role !== "student" || readIds.has(announcement.id)
              const selected = selectedAnnouncementId === announcement.id
              return (
                <article id={`announcement-${announcement.id}`} key={announcement.id} className={`rounded-3xl border bg-white p-5 shadow-sm transition sm:p-7 ${selected ? "border-kez-blue ring-2 ring-blue-100" : "border-transparent"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-kez-dark">{announcement.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{authorName(announcement.author)} · <time dateTime={announcement.published_at}>{formatNotificationTime(announcement.published_at)}</time></p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isRead ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-kez-blue"}`}>{isRead ? "Read" : "Unread"}</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{announcement.body}</p>
                  {!isRead && (
                    <button type="button" onClick={() => void markAnnouncementRead(announcement.id)} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-kez-blue hover:underline">
                      <Check size={16} aria-hidden="true" /> Mark as read
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
