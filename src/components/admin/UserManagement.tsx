import { FormEvent, useEffect, useState } from "react"
import {
  createUser,
  deleteUser,
  listUsers,
  roleLabels,
  sendPasswordEmail,
  updateUser,
  type ManagedUser,
  type Role,
} from "../../lib/admin"
import { listRoster, setLearnerTutor, tutorOf, type RosterLink } from "../../lib/classroom"

const ROLES = Object.keys(roleLabels) as Role[]
const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kez-blue"

const roleBadge: Record<Role, string> = {
  student: "bg-kez-blue-light text-kez-blue",
  tutor: "bg-green-50 text-green-700",
  admin: "bg-amber-100 text-amber-700",
  super_admin: "bg-violet-100 text-violet-700",
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "student" as Role })
  const [invite, setInvite] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const user = await createUser({
        ...form,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        password: invite ? undefined : form.password,
      })
      setMessage({
        ok: true,
        text: invite
          ? `✓ Invite sent to ${user.email} (${roleLabels[user.role]}). They'll choose their own password from the email.`
          : `✓ Created ${user.email} as ${roleLabels[user.role]}. Share the password with them securely; they can change it under Profile.`,
      })
      setForm({ full_name: "", email: "", password: "", role: "student" })
      onCreated()
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-extrabold">Create an account</h2>
      <p className="mt-1 text-xs text-slate-500">
        {invite
          ? "We'll email them an invite link to set their own password."
          : "The account works immediately with the password you set; no email is sent."}
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="accent-kez-blue" />
        Send an invite email
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
        {!invite && (
          <input
            required
            type="text"
            minLength={8}
            placeholder="Temporary password (8+ characters)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={input}
            autoComplete="new-password"
          />
        )}
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={input}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={saving} className="mt-4 rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "Creating…" : invite ? "Create & send invite" : "Create account"}
      </button>
      {message && (
        <p className={`mt-4 rounded-xl p-3 text-xs font-bold ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}
    </form>
  )
}

function UserRow({
  user,
  isMe,
  tutors,
  tutorId,
  onChanged,
}: {
  user: ManagedUser
  isMe: boolean
  tutors: ManagedUser[]
  tutorId: string | null
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.full_name)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      setEditing(false)
      setPassword("")
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(() =>
      updateUser(user.id, {
        ...(name.trim() && name.trim() !== user.full_name ? { full_name: name.trim() } : {}),
        ...(password ? { password } : {}),
      }),
    )

  const [notice, setNotice] = useState<string | null>(null)
  const emailLink = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { sent_to } = await sendPasswordEmail(user.id)
      setNotice(`✓ Password link sent to ${sent_to}.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    const ok = window.confirm(
      `Delete ${user.email}?\n\nThis permanently removes the account and ALL of its recordings, results and feedback. This cannot be undone.`,
    )
    if (ok) run(() => deleteUser(user.id))
  }

  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <b className="block text-sm">
            {user.full_name} {isMe && <span className="text-xs font-semibold text-slate-400">(you)</span>}
          </b>
          <span className="text-xs text-slate-500">{user.email}</span>
        </div>
        {user.role === "student" && (
          <select
            value={tutorId ?? ""}
            disabled={busy}
            title="This student's tutor"
            aria-label={`Tutor for ${user.full_name}`}
            onChange={(e) => run(() => setLearnerTutor(user.id, e.target.value || null))}
            className="rounded-xl border border-slate-200 px-2 py-1 text-xs outline-none disabled:opacity-70"
          >
            <option value="">Tutor: none</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                Tutor: {t.full_name}
              </option>
            ))}
          </select>
        )}
        <select
          value={user.role}
          disabled={busy || isMe}
          title={isMe ? "You can't change your own role" : "Change role"}
          onChange={(e) => run(() => updateUser(user.id, { role: e.target.value as Role }))}
          className={`rounded-full px-3 py-1 text-xs font-bold outline-none disabled:opacity-70 ${roleBadge[user.role]}`}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
        <button onClick={() => setEditing(!editing)} disabled={busy} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
          {editing ? "Cancel" : "Edit"}
        </button>
        {!isMe && (
          <button onClick={remove} disabled={busy} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
            Delete
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} />
          <input
            value={password}
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (leave blank to keep)"
            className={input}
            autoComplete="new-password"
          />
          <button onClick={save} disabled={busy || (password !== "" && password.length < 8)} className="rounded-xl bg-kez-blue px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <button type="button" onClick={emailLink} disabled={busy} className="rounded-xl bg-kez-blue-light px-3 py-1.5 text-xs font-bold text-kez-blue disabled:opacity-60">
              ✉ Send password email
            </button>
            <span className="text-[11px] text-slate-500">Emails a link to set a new password. Also use it to resend an invite.</span>
          </div>
        </div>
      )}
      {notice && <p className="mt-2 text-xs font-semibold text-green-700">{notice}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  )
}

/** Super-admin account management: create, list, edit, change role, delete. */
export default function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [roster, setRoster] = useState<RosterLink[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all")
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    Promise.all([listUsers(), listRoster()])
      .then(([data, links]) => {
        setUsers(data)
        setRoster(links)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [version])

  const tutors = (users ?? []).filter((u) => u.role === "tutor")

  const q = query.trim().toLowerCase()
  const visible = (users ?? []).filter(
    (u) =>
      (roleFilter === "all" || u.role === roleFilter) &&
      (!q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className={`${input} flex-1`} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "all")} className={`${input} w-auto`}>
            <option value="all">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-xs text-slate-500">Set each student's tutor. Tutors only see, assign work to and grade their own students.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!users && !error && <p className="mt-4 text-sm text-slate-500">Loading accounts…</p>}
        {users && (
          <div className="mt-2">
            {visible.map((user) => {
              const tutorId = tutorOf(roster, user.id)
              return (
                <UserRow
                  key={`${user.id}-${user.role}-${user.full_name}-${tutorId}`}
                  user={user}
                  isMe={user.id === currentUserId}
                  tutors={tutors}
                  tutorId={tutorId}
                  onChanged={reload}
                />
              )
            })}
            {!visible.length && <p className="py-4 text-sm text-slate-500">No accounts match.</p>}
          </div>
        )}
      </section>
      <CreateUserForm onCreated={reload} />
    </div>
  )
}
