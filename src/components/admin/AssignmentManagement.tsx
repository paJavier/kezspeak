import { FormEvent, useEffect, useState } from "react"
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  listUsers,
  updateAssignment,
  type Assignment,
  type ManagedUser,
} from "../../lib/admin"
import { listTasks, type AssessmentTask } from "../../lib/assessments"

const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kez-blue"

/**
 * Link learners to tutors through a task. Tutors only see submissions from
 * learners they have an assignment with (RLS), so this drives tutor access.
 */
export default function AssignmentManagement() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [tasks, setTasks] = useState<AssessmentTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ learner_id: "", tutor_id: "", task_id: "", due_at: "" })
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    Promise.all([listAssignments(), listUsers(), listTasks()])
      .then(([a, u, t]) => {
        setAssignments(a)
        setUsers(u)
        setTasks(t)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [version])

  const learners = users.filter((u) => u.role === "student")
  const tutors = users.filter((u) => u.role === "tutor")
  const nameOf = (id: string) => users.find((u) => u.id === id)?.full_name ?? "Unknown user"

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createAssignment({
        learner_id: form.learner_id,
        tutor_id: form.tutor_id,
        task_id: form.task_id,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      })
      setForm({ ...form, task_id: "", due_at: "" })
      reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!assignments && !error && <p className="text-sm text-slate-500">Loading assignments…</p>}
        {assignments?.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-4 last:border-0">
            <div className="min-w-0 flex-1">
              <b className="block text-sm">{nameOf(a.learner_id)}</b>
              <span className="text-xs text-slate-500">
                {a.task?.title ?? "Task"} · {a.status}
                {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ""}
              </span>
            </div>
            <select
              value={a.tutor_id}
              onChange={(e) => run(() => updateAssignment(a.id, { tutor_id: e.target.value }))}
              className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
              title="Reassign tutor"
            >
              {!tutors.some((t) => t.id === a.tutor_id) && <option value={a.tutor_id}>{nameOf(a.tutor_id)}</option>}
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.confirm("Remove this assignment? The tutor may lose access to this learner's recordings.") && run(() => deleteAssignment(a.id))}
              className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        {assignments && !assignments.length && <p className="text-sm text-slate-500">No assignments yet.</p>}
      </section>

      <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-extrabold">Assign a task</h2>
        <p className="mt-1 text-xs text-slate-500">The tutor will then see this learner's submissions.</p>
        <div className="mt-4 space-y-3">
          <select required value={form.learner_id} onChange={(e) => setForm({ ...form, learner_id: e.target.value })} className={input}>
            <option value="">Learner…</option>
            {learners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
          <select required value={form.tutor_id} onChange={(e) => setForm({ ...form, tutor_id: e.target.value })} className={input}>
            <option value="">Tutor / Teacher…</option>
            {tutors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
          <select required value={form.task_id} onChange={(e) => setForm({ ...form, task_id: e.target.value })} className={input}>
            <option value="">Task…</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.kind})
              </option>
            ))}
          </select>
          <label className="block text-xs text-slate-500">
            Due date (optional)
            <input type="date" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} className={`${input} mt-1`} />
          </label>
        </div>
        {!tutors.length && users.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">No tutor accounts yet. Create one or change a role under Users.</p>
        )}
        <button type="submit" disabled={saving} className="mt-4 rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Assigning…" : "Assign"}
        </button>
      </form>
    </div>
  )
}
