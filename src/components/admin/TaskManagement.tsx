import { FormEvent, useEffect, useRef, useState } from "react"
import { FileText, Sparkles, X } from "lucide-react"
import { deleteTask, saveTask, type TaskInput } from "../../lib/admin"
import { listTasks, type AssessmentTask, type TaskKind } from "../../lib/assessments"

const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kez-blue"
const kindLabels: Record<TaskKind, string> = { pre: "Pre-Assessment", post: "Post-Assessment", practice: "Practice" }
const EMPTY: TaskInput = { title: "", prompt: "", skill_focus: "", kind: "practice", duration_seconds: 60 }
const MAX_REFERENCE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"]

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TaskForm({
  task,
  onDone,
  currentUserId,
  isAdmin,
}: {
  task: AssessmentTask | null
  onDone: () => void
  currentUserId: string
  isAdmin: boolean
}) {
  // Pre/post prompts are standardized for the research; only admins set them.
  const kinds = (Object.keys(kindLabels) as TaskKind[]).filter((k) => isAdmin || k === "practice")
  const [form, setForm] = useState<TaskInput>(task ? { ...task, skill_focus: task.skill_focus ?? "" } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState({ title: "", prompt: "", followUpQuestions: "", skillFocus: "", duration: "" })

  const chooseReference = (file?: File) => {
    setFileError(null)
    if (!file) return
    const extension = file.name.split(".").pop()?.toLowerCase()
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      setReferenceFile(null)
      setFileError("Choose a PDF, DOCX, or TXT file.")
      return
    }
    if (file.size > MAX_REFERENCE_SIZE) {
      setReferenceFile(null)
      setFileError("The file must be 10 MB or smaller.")
      return
    }
    setReferenceFile(file)
  }

  const removeReference = () => {
    setReferenceFile(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveTask(
        { ...form, title: form.title.trim(), prompt: form.prompt.trim(), skill_focus: form.skill_focus?.trim() || null },
        task?.id,
        currentUserId,
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
            {kinds.map((kind) => (
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
      {!task && (
        <>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-labelledby="reference-material-heading">
            <div>
              <h3 id="reference-material-heading" className="text-sm font-extrabold">Upload Reference Material <span className="font-medium text-slate-400">(optional)</span></h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Add a reading or lesson resource to use as context for a future speaking activity. Files stay in this form and are not uploaded.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="sr-only"
              aria-label="Choose reference material"
              onChange={(event) => chooseReference(event.target.files?.[0])}
            />
            {referenceFile ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kez-blue-light text-kez-blue"><FileText size={19} /></span>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-bold text-slate-700">{referenceFile.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(referenceFile.size)}</p>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Replace</button>
                <button type="button" onClick={removeReference} aria-label="Remove reference file" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><X size={17} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-kez-blue">
                <FileText size={22} className="text-kez-blue" />
                <span className="mt-2 text-sm font-bold text-slate-700">Choose a file</span>
                <span className="mt-1 text-xs text-slate-500">PDF, DOCX, or TXT · up to 10 MB</span>
              </button>
            )}
            {fileError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{fileError}</p>}
            {referenceFile && (
              <div className="mt-4">
                <button type="button" disabled title="AI activity generation is not connected yet." className="flex w-full items-center justify-center gap-2 rounded-xl bg-kez-blue px-4 py-3 text-sm font-bold text-white opacity-60 disabled:cursor-not-allowed">
                  <Sparkles size={17} /> Generate Activity
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">AI generation is not connected yet. Your file remains on this page.</p>
              </div>
            )}
          </section>

          <section className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 sm:p-5" aria-labelledby="activity-preview-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 id="activity-preview-heading" className="text-sm font-extrabold">Activity preview</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Future generated content will appear here. These fields are editable; nothing is generated or saved from this preview.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">Not generated</span>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-600">Activity title
                <input value={preview.title} onChange={(e) => setPreview({ ...preview, title: e.target.value })} placeholder="Generated activity title" className={`${input} mt-1 font-normal`} />
              </label>
              <label className="block text-xs font-bold text-slate-600">Speaking prompt
                <textarea value={preview.prompt} onChange={(e) => setPreview({ ...preview, prompt: e.target.value })} placeholder="The learner-facing prompt will appear here" className={`${input} mt-1 h-20 font-normal`} />
              </label>
              <label className="block text-xs font-bold text-slate-600">Follow-up questions
                <textarea value={preview.followUpQuestions} onChange={(e) => setPreview({ ...preview, followUpQuestions: e.target.value })} placeholder="One question per line" className={`${input} mt-1 h-20 font-normal`} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-600">Skill focus
                  <input value={preview.skillFocus} onChange={(e) => setPreview({ ...preview, skillFocus: e.target.value })} placeholder="e.g. fluency" className={`${input} mt-1 font-normal`} />
                </label>
                <label className="block text-xs font-bold text-slate-600">Duration
                  <input value={preview.duration} onChange={(e) => setPreview({ ...preview, duration: e.target.value })} placeholder="e.g. 2 minutes" className={`${input} mt-1 font-normal`} />
                </label>
              </div>
            </div>
          </section>
        </>
      )}
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

/**
 * Create, edit and delete speaking tasks. Admins manage everything, including
 * the standardized pre/post tasks; tutors manage only practice tasks they created.
 */
export default function TaskManagement({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const canChange = (task: AssessmentTask) => isAdmin || (task.kind === "practice" && task.created_by === currentUserId)
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
            {canChange(task) ? (
              <>
                <button onClick={() => setEditing(task)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                  Edit
                </button>
                <button onClick={() => remove(task)} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                  Delete
                </button>
              </>
            ) : (
              <span className="text-[11px] text-slate-400" title="Pre/post and other tutors' tasks are managed by an administrator">
                View only
              </span>
            )}
          </div>
        ))}
        {tasks && !tasks.length && <p className="text-sm text-slate-500">No tasks yet.</p>}
      </section>
      <TaskForm key={editing?.id ?? "new"} task={editing} onDone={reload} currentUserId={currentUserId} isAdmin={isAdmin} />
    </div>
  )
}
