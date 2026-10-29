import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Check, Megaphone, Send } from "lucide-react"
import { supabase } from "../../lib/supabase"
import type { AnnouncementAudience, NotificationRole } from "../../lib/notifications"
import { audienceLabel, audienceOptions, formatNotificationTime } from "../../lib/notifications"
import { useNotifications } from "./NotificationProvider"

type Announcement = {
  id: string
  title: string
  body: string
  author_id: string
  audience: AnnouncementAudience
  published_at: string
  author: AuthorRow | AuthorRow[] | null
}

type AuthorRow = { full_name: string; role: NotificationRole }

type Props = {
  userId: string
  role: NotificationRole
  selectedAnnouncementId?: string | null
}

const authorRow = (author: Announcement["author"]) => (Array.isArray(author) ? author[0] : author) ?? null

export default function AnnouncementsPage({ userId, role, selectedAnnouncementId }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [readIds, setReadIds] = useState(new Set<string>())
  // Announcements this user received (as opposed to wrote or can see as an admin).
  const [receivedIds, setReceivedIds] = useState(new Set<string>())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const audiences = audienceOptions(role)
  const [form, setForm] = useState<{ title: string; body: string; audience: AnnouncementAudience }>({ title: "", body: "", audience: audiences[0] ?? "students" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [version, setVersion] = useState(0)
  const { notifications, markRead } = useNotifications()
  const canPublish = audiences.length > 0

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      const announcementsResult = await supabase
        .from("announcements")
        .select("id,title,body,author_id,audience,published_at,author:profiles!announcements_author_id_fkey(full_name,role)")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
      if (!active) return
      if (announcementsResult.error) {
        setError(announcementsResult.error.message)
        setLoading(false)
        return
      }

      // Tutors and staff can be recipients too (audience "everyone" or "tutors").
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
      const rows = readsResult.data ?? []

      setAnnouncements((announcementsResult.data ?? []) as Announcement[])
      setReceivedIds(new Set(rows.map((row) => row.announcement_id)))
      setReadIds(new Set(rows.filter((row) => row.read_at).map((row) => row.announcement_id)))
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
        audience: form.audience,
        published_at: new Date().toISOString(),
      })
      if (publishError) throw new Error(publishError.message)
      setForm({ ...form, title: "", body: "" })
      setMessage(role === "tutor" ? "Announcement shared with your students." : `Announcement published to ${audienceLabel(form.audience, role).toLowerCase()}.`)
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
              <p className="text-sm text-slate-500">{role === "tutor" ? "Shared with your students only." : "Choose who receives it."}</p>
            </div>
          </div>
          {audiences.length > 1 && (
            <label className="mt-5 block text-xs font-bold text-slate-600">Send to
              <select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as AnnouncementAudience })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-kez-blue">
                {audiences.map((value) => <option key={value} value={value}>{audienceLabel(value, role)}</option>)}
              </select>
            </label>
          )}
          <input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Announcement title" className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-kez-blue" />
          <textarea required maxLength={4000} rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write your announcement…" className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-kez-blue" />
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
            <p className="mt-1 text-sm text-slate-500">{canPublish ? "Use the form above to share your first update." : "Updates from your tutor and the KezSpeak team will show here."}</p>
          </div>
        )}
        {!loading && !error && announcements.length > 0 && (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const author = authorRow(announcement.author)
              const received = receivedIds.has(announcement.id)
              const isRead = !received || readIds.has(announcement.id)
              const mine = announcement.author_id === userId
              const selected = selectedAnnouncementId === announcement.id
              return (
                <article id={`announcement-${announcement.id}`} key={announcement.id} className={`rounded-3xl border bg-white p-5 shadow-sm transition sm:p-7 ${selected ? "border-kez-blue ring-2 ring-blue-100" : !isRead ? "border-blue-200" : "border-transparent"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-kez-dark">{announcement.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{author?.full_name ?? "KezSpeak"} · <time dateTime={announcement.published_at}>{formatNotificationTime(announcement.published_at)}</time></p>
                    </div>
                    {received ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${isRead ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-kez-blue"}`}>{isRead ? "Read" : "Unread"}</span>
                    ) : role !== "student" && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                        {mine ? "Posted by you" : "Sent"} · {audienceLabel(announcement.audience ?? "students", author?.role ?? "admin")}
                      </span>
                    )}
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
