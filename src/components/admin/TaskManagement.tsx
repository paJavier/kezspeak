import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Eye, FileText, Sparkles, X } from "lucide-react"
import TaskPreview from "../TaskPreview"
import {
  deleteTask,
  draftPrompt,
  generateActivityDraft,
  saveTask,
  splitPrompt,
  type ActivityDraft,
  type TaskInput,
} from "../../lib/admin"
import {
  listTasks,
  type AssessmentTask,
  type TaskKind,
} from "../../lib/assessments"
import { EXAM_TEMPLATES, examStyleLabels, type ExamStyle } from "../../lib/exams"

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-kez-blue"
// Textareas grow with their content (field-sizing) instead of scrolling in a tiny box.
const growing = "[field-sizing:content] resize-y"
const label = "block text-xs font-bold text-slate-600"
const kindLabels: Record<TaskKind, string> = {
  pre: "Pre-Assessment",
  post: "Post-Assessment",
  practice: "Practice",
}
const kindStyles: Record<TaskKind, string> = {
  pre: "bg-amber-50 text-amber-800",
  post: "bg-green-50 text-green-800",
  practice: "bg-kez-blue-light text-kez-blue",
}
const EMPTY: TaskInput = {
  title: "",
  prompt: "",
  skill_focus: "",
  kind: "practice",
  duration_seconds: 60,
}
const MAX_REFERENCE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"]

type AiField = "title" | "prompt" | "followUps" | "skill_focus" | "duration_seconds"

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length

/**
 * Upload reference material and let Gemini draft a speaking task. The file is
 * sent to ml-service for this request only and is not stored. The draft goes
 * straight into the task form, where the tutor reviews and edits it before saving.
 */
function AiDraftPanel({
  hasContent,
  examStyle,
  onDraft,
}: {
  hasContent: boolean
  /** The form's exam style; the draft follows that exam's task format. */
  examStyle: ExamStyle | null
  onDraft: (draft: ActivityDraft) => void
}) {
  const [open, setOpen] = useState(false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [focusHint, setFocusHint] = useState("")
  const [fileError, setFileError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const generate = async () => {
    if (!referenceFile || generating) return
    if (
      hasContent &&
      !window.confirm(
        "Replace the current title, prompt and questions with a new AI draft?",
      )
    )
      return
    setGenerating(true)
    setGenerateError(null)
    try {
      onDraft(await generateActivityDraft(referenceFile, focusHint, examStyle))
      setGenerated(true)
    } catch (err) {
      setGenerateError(
        (err as Error).message || "The activity could not be drafted.",
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-violet-200 bg-violet-50/60"
      aria-labelledby="ai-draft-heading"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left sm:px-5"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            id="ai-draft-heading"
            className="block text-sm font-extrabold text-kez-dark"
          >
            Draft with AI{" "}
            <span className="font-medium text-slate-400">(optional)</span>
          </span>
          <span className="block text-xs text-slate-500">
            Upload a reading or lesson resource and AI fills in the form for you
            to review.
          </span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-violet-200 p-4 sm:p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            aria-label="Choose reference material"
            onChange={(event) => chooseReference(event.target.files?.[0])}
          />
          {referenceFile ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kez-blue-light text-kez-blue">
                <FileText size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-bold text-slate-700">
                  {referenceFile.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatFileSize(referenceFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={removeReference}
                aria-label="Remove reference file"
                className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
              >
                <X size={17} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-kez-blue"
            >
              <FileText
                size={22}
                className="text-kez-blue"
                aria-hidden="true"
              />
              <span className="mt-2 text-sm font-bold text-slate-700">
                Choose a file
              </span>
              <span className="mt-1 text-xs text-slate-500">
                PDF, DOCX, or TXT · up to 10 MB
              </span>
            </button>
          )}
          {fileError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700"
            >
              {fileError}
            </p>
          )}

          <label className={label}>
            Focus for the activity{" "}
            <span className="font-medium text-slate-400">(optional)</span>
            <input
              value={focusHint}
              maxLength={80}
              onChange={(e) => setFocusHint(e.target.value)}
              placeholder="e.g. giving opinions"
              className={`${input} mt-1 font-normal`}
            />
          </label>

          <div>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={!referenceFile || generating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-kez-blue px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles size={17} aria-hidden="true" />{" "}
              {generating
                ? "Drafting…"
                : generated
                  ? "Generate again"
                  : "Generate activity"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Your file is sent to the AI to draft an activity and is not
              stored.
            </p>
          </div>
          {generateError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700"
            >
              {generateError}
            </p>
          )}
          {generated && !generateError && (
            <p
              role="status"
              className="rounded-lg bg-white p-3 text-xs font-bold text-violet-800"
            >
              Draft added to the form. Review and edit it before creating the
              task.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** A form label with a violet "AI draft" chip while the field still holds unedited AI text. */
function FieldLabel({ children, ai }: { children: ReactNode, ai: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      {ai && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
          AI draft
        </span>
      )}
    </span>
  )
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
  const kinds = (Object.keys(kindLabels) as TaskKind[]).filter(
    (k) => isAdmin || k === "practice",
  )
  // Follow-up questions live in the prompt text; edit them in their own field.
  const [initial] = useState(() => splitPrompt(task?.prompt ?? ""))
  const [form, setForm] = useState<TaskInput>(
    task
      ? { ...task, prompt: initial.prompt, skill_focus: task.skill_focus ?? "" }
      : EMPTY,
  )
  const [followUps, setFollowUps] = useState(initial.followUps.join("\n"))
  const [aiFields, setAiFields] = useState(new Set<AiField>())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const questionLines = followUps.split("\n").filter((q) => q.trim())
  const fullPrompt = draftPrompt(form.prompt, questionLines)
  const hasContent = Boolean(
    form.title.trim() || form.prompt.trim() || followUps.trim(),
  )
  const suggestedSeconds = Math.min(180, 30 + questionLines.length * 25)

  // Editing a field by hand means the tutor has reviewed it: drop its AI chip.
  const touch = (field: AiField) =>
    setAiFields((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
  const edit = (
    field: Exclude<AiField, "followUps">,
    patch: Partial<TaskInput>,
  ) => {
    setForm((current) => ({ ...current, ...patch }))
    touch(field)
  }

  const applyDraft = (draft: ActivityDraft) => {
    setForm((current) => ({
      ...current,
      title: draft.title,
      prompt: draft.prompt,
      skill_focus: draft.skill_focus,
      duration_seconds: draft.duration_seconds,
    }))
    setFollowUps(draft.follow_up_questions.join("\n"))
    setAiFields(
      new Set<AiField>([
        "title",
        "prompt",
        "followUps",
        "skill_focus",
        "duration_seconds",
      ]),
    )
  }

  // Exam-style templates fill the whole form (original KezSpeak prompts, lib/exams.ts).
  const applyTemplate = (style: string) => {
    const template = EXAM_TEMPLATES.find((t) => t.style === style)
    if (!template) return
    if (hasContent && !window.confirm("Replace the current title, prompt and questions with this template?")) return
    setForm((current) => ({
      ...current,
      title: template.title,
      prompt: template.prompt,
      skill_focus: template.skillFocus,
      duration_seconds: template.durationSeconds,
      exam_style: template.style,
      prep_seconds: template.prepSeconds,
    }))
    setFollowUps(template.followUps.join("\n"))
    setAiFields(new Set())
  }

  // Same checks as submitting, so the preview never shows an unsaveable task.
  const openPreview = () => {
    if (formRef.current?.reportValidity()) setPreviewing(true)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setPreviewing(false)
    setSaving(true)
    setError(null)
    try {
      await saveTask(
        {
          ...form,
          title: form.title.trim(),
          prompt: fullPrompt,
          skill_focus: form.skill_focus?.trim() || null,
        },
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
    <form
      ref={formRef}
      onSubmit={submit}
      className="rounded-3xl bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-extrabold text-kez-dark">
        {task ? "Edit task" : "New speaking task"}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {isAdmin
          ? "Pre/post tasks are the standardized research prompts."
          : "Tutors create practice tasks for their students."}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: what the learner reads. */}
        <div className="min-w-0 space-y-4">
          <label className={label}>
            Start from an exam template{" "}
            <span className="font-medium text-slate-400">(optional)</span>
            <select
              value=""
              onChange={(e) => applyTemplate(e.target.value)}
              className={`${input} mt-1 font-normal`}
            >
              <option value="">Choose IELTS, TOEFL-style or Cambridge-style…</option>
              {EXAM_TEMPLATES.map((t) => (
                <option key={t.style} value={t.style}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            <FieldLabel ai={aiFields.has("title")}>Title</FieldLabel>
            <input
              required
              value={form.title}
              onChange={(e) => edit("title", { title: e.target.value })}
              className={`${input} mt-1 font-normal`}
            />
          </label>
          <label className={label}>
            <FieldLabel ai={aiFields.has("prompt")}>
              Prompt the learner will see
            </FieldLabel>
            <textarea
              required
              value={form.prompt}
              onChange={(e) => edit("prompt", { prompt: e.target.value })}
              className={`${input} ${growing} mt-1 min-h-32 max-h-80 font-normal leading-6`}
            />
          </label>
          <label className={label}>
            <FieldLabel ai={aiFields.has("followUps")}>
              Follow-up questions{" "}
              <span className="font-medium text-slate-400">
                (optional, one per line)
              </span>
            </FieldLabel>
            <textarea
              value={followUps}
              onChange={(e) => {
                setFollowUps(e.target.value)
                touch("followUps")
              }}
              placeholder={
                "What do you like most about it?\nWhat would you change?"
              }
              className={`${input} ${growing} mt-1 min-h-20 max-h-60 font-normal leading-6`}
            />
            <span className="mt-1 block font-normal text-slate-400">
              Students see these under the prompt as "Also answer:".
            </span>
          </label>
        </div>

        {/* Right: AI draft, settings and actions. */}
        <div className="min-w-0 space-y-4">
          {!task && (
            <AiDraftPanel hasContent={hasContent} examStyle={form.exam_style ?? null} onDraft={applyDraft} />
          )}
          <label className={label}>
            <FieldLabel ai={aiFields.has("skill_focus")}>
              Skill focus{" "}
              <span className="font-medium text-slate-400">(optional)</span>
            </FieldLabel>
            <input
              value={form.skill_focus ?? ""}
              onChange={(e) =>
                edit("skill_focus", { skill_focus: e.target.value })
              }
              placeholder="e.g. describing preferences"
              className={`${input} mt-1 font-normal`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Type
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as TaskKind })
                }
                className={`${input} mt-1 font-normal`}
              >
                {kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              <FieldLabel ai={aiFields.has("duration_seconds")}>
                Duration (seconds)
              </FieldLabel>
              <input
                type="number"
                min={10}
                max={300}
                required
                value={form.duration_seconds}
                onChange={(e) =>
                  edit("duration_seconds", {
                    duration_seconds: Number(e.target.value),
                  })
                }
                className={`${input} mt-1 font-normal`}
              />
            </label>
            <label className={label}>
              Exam style
              <select
                value={form.exam_style ?? ""}
                onChange={(e) => setForm({ ...form, exam_style: (e.target.value || null) as ExamStyle | null })}
                className={`${input} mt-1 font-normal`}
              >
                <option value="">None</option>
                {EXAM_TEMPLATES.map((t) => (
                  <option key={t.style} value={t.style}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Preparation (seconds)
              <input
                type="number"
                min={0}
                max={120}
                value={form.prep_seconds ?? 0}
                onChange={(e) => setForm({ ...form, prep_seconds: Number(e.target.value) })}
                className={`${input} mt-1 font-normal`}
              />
            </label>
          </div>
          <p className="text-[11px] leading-5 text-slate-400">
            {countWords(form.prompt)} words in the prompt ·{" "}
            {questionLines.length} follow-up question
            {questionLines.length === 1 ? "" : "s"} · about {suggestedSeconds}s
            suggested
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : task ? "Save changes" : "Create task"}
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="inline-flex items-center gap-2 rounded-xl bg-kez-blue-light px-5 py-3 text-sm font-bold text-kez-blue"
            >
              <Eye size={16} aria-hidden="true" /> Preview
            </button>
            {task && (
              <button
                type="button"
                onClick={onDone}
                className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </div>
      {previewing && (
        <TaskPreview
          task={{
            ...form,
            title: form.title.trim(),
            prompt: fullPrompt,
            skill_focus: form.skill_focus?.trim() || null,
          }}
          note="Students see this task under Speaking Activities once it is created. Assign it under Classwork to give it a due date."
          confirmLabel={task ? "Save changes" : "Create task"}
          busy={saving}
          onConfirm={() => void submit()}
          onClose={() => setPreviewing(false)}
        />
      )}
    </form>
  )
}

/**
 * Create, edit and delete speaking tasks. Admins manage everything, including
 * the standardized pre/post tasks; tutors manage only practice tasks they created.
 */
export default function TaskManagement({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string
  isAdmin: boolean
}) {
  const canChange = (task: AssessmentTask) =>
    isAdmin || (task.kind === "practice" && task.created_by === currentUserId)
  const [tasks, setTasks] = useState<AssessmentTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AssessmentTask | null>(null)
  const [version, setVersion] = useState(0)
  const formAnchor = useRef<HTMLDivElement>(null)
  const reload = () => {
    setEditing(null)
    setVersion((v) => v + 1)
  }
  // The form sits above the list, so bring it into view when editing.
  const startEditing = (task: AssessmentTask) => {
    setEditing(task)
    formAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((err: Error) => setError(err.message))
  }, [version])

  const remove = async (task: AssessmentTask) => {
    if (
      !window.confirm(
        `Delete "${task.title}"? Its assignments are removed too.`,
      )
    )
      return
    try {
      await deleteTask(task.id)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div ref={formAnchor} className="scroll-mt-6">
        <TaskForm
          key={editing?.id ?? "new"}
          task={editing}
          onDone={reload}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      </div>
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold text-kez-dark">
            Speaking tasks
          </h2>
          {tasks && (
            <span className="text-xs font-bold text-slate-400">
              {tasks.length} total
            </span>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {!tasks && !error && (
          <p role="status" className="py-6 text-sm text-slate-500">
            Loading tasks…
          </p>
        )}
        {tasks && tasks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tasks.map((task) => (
              <article
                key={task.id}
                className={`flex flex-col rounded-2xl border p-4 ${
                  editing?.id === task.id
                    ? "border-kez-blue ring-2 ring-blue-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <b className="min-w-0 text-sm text-kez-dark">{task.title}</b>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${kindStyles[task.kind]}`}
                  >
                    {kindLabels[task.kind]}
                  </span>
                  {task.exam_style && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                      {examStyleLabels[task.exam_style] ?? task.exam_style}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-500">
                  {task.prompt}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {task.prep_seconds ? `${task.prep_seconds}s prep · ` : ""}
                  {task.duration_seconds}s
                  {task.skill_focus ? ` · ${task.skill_focus}` : ""}
                </p>
                <div className="mt-auto flex gap-2 pt-4">
                  {canChange(task) ? (
                    <>
                      <button
                        onClick={() => startEditing(task)}
                        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                      >
                        {editing?.id === task.id ? "Editing…" : "Edit"}
                      </button>
                      <button
                        onClick={() => remove(task)}
                        className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <span
                      className="text-[11px] text-slate-400"
                      title="Pre/post and other tutors' tasks are managed by an administrator"
                    >
                      View only
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {tasks && !tasks.length && (
          <div className="py-10 text-center">
            <FileText
              className="mx-auto text-slate-300"
              size={30}
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-bold text-kez-dark">No tasks yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create one with the form, or draft one from reference material
              with AI.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
