import { FormEvent, useEffect, useState } from "react"
import { deleteTask, saveTask, type TaskInput } from "../../lib/admin"
import { listTasks, type AssessmentTask, type TaskKind } from "../../lib/assessments"

const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kez-blue"
const kindLabels: Record<TaskKind, string> = { pre: "Pre-Assessment", post: "Post-Assessment", practice: "Practice" }
const EMPTY: TaskInput = { title: "", prompt: "", skill_focus: "", kind: "practice", duration_seconds: 60 }

function TaskForm({ task, onDone }: { task: AssessmentTask | null; onDone: () => void }) {
  const [form, setForm] = useState<TaskInput>(task ? { ...task, skill_focus: task.skill_focus ?? "" } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveTask(
        { ...form, title: form.title.trim(), prompt: form.prompt.trim(), skill_focus: form.skill_focus?.trim() || null },
        task?.id,
      )
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-extrabold">{task ? "Edit task" : "New speaking task"}</h2>
      <div className="mt-4 space-y-3">
        <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
        <textarea
          required
          placeholder="Prompt the learner will see"
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          className={`${input} h-28`}
        />
        <input placeholder="Skill focus (optional)" value={form.skill_focus ?? ""} onChange={(e) => setForm({ ...form, skill_focus: e.target.value })} className={input} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TaskKind })} className={input}>
            {(Object.keys(kindLabels) as TaskKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {kindLabels[kind]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="number"
              min={10}
              max={300}
              required
              value={form.duration_seconds}
              onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })}
              className={input}
            />
            seconds
          </label>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Saving…" : task ? "Save changes" : "Create task"}
        </button>
        {task && (
          <button type="button" onClick={onDone} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600">
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
    </form>
  )
}

/** Create, edit and delete the standardized pre/post/practice speaking tasks. */
export default function TaskManagement() {
  const [tasks, setTasks] = useState<AssessmentTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AssessmentTask | null>(null)
  const [version, setVersion] = useState(0)
  const reload = () => {
    setEditing(null)
    setVersion((v) => v + 1)
  }

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((err: Error) => setError(err.message))
  }, [version])

  const remove = async (task: AssessmentTask) => {
    if (!window.confirm(`Delete "${task.title}"? Its assignments are removed too.`)) return
    try {
      await deleteTask(task.id)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!tasks && !error && <p className="text-sm text-slate-500">Loading tasks…</p>}
        {tasks?.map((task) => (
          <div key={task.id} className="flex flex-wrap items-start gap-3 border-b border-slate-100 py-4 last:border-0">
            <div className="min-w-0 flex-1">
              <b className="text-sm">{task.title}</b>
              <span className="ml-2 rounded-full bg-kez-blue-light px-2 py-0.5 text-[11px] font-bold text-kez-blue">{kindLabels[task.kind]}</span>
              <p className="mt-1 text-xs leading-5 text-slate-500">{task.prompt}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {task.duration_seconds}s{task.skill_focus ? ` · ${task.skill_focus}` : ""}
              </p>
            </div>
            <button onClick={() => setEditing(task)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
              Edit
            </button>
            <button onClick={() => remove(task)} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
              Delete
            </button>
          </div>
        ))}
        {tasks && !tasks.length && <p className="text-sm text-slate-500">No tasks yet.</p>}
      </section>
      <TaskForm key={editing?.id ?? "new"} task={editing} onDone={reload} />
    </div>
  )
}
