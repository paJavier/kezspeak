import { FormEvent, type ReactNode, useEffect, useState } from "react"
import { listTasks, type AssessmentTask, type Submission } from "../../lib/assessments"
import {
  assignTask,
  classworkState,
  deleteAssignment,
  displayGrade,
  formatDue,
  gradeAssignment,
  latestSubmissionFor,
  listAssignments,
  listPeople,
  listRoster,
  stateLabels,
  stateStyles,
  suggestedGrade,
  tutorOf,
  updateDueDate,
  type Assignment,
  type Person,
  type RosterLink,
} from "../../lib/classroom"

const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kez-blue"

// <input type="datetime-local"> works in local time without a zone suffix.
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
// Earliest allowed due date in the pickers, so past dates can't be chosen.
const nowLocalInput = () => toLocalInput(new Date().toISOString())

/**
 * Tutors assign speaking tasks to their students, set a deadline and grade
 * what was turned in. Overdue work with no recording is Missing (0). The grade
 * is a class grade; the machine score is only a suggestion.
 */
export default function Classwork({
  currentUserId,
  isAdmin,
  isSuperAdmin,
  submissions,
  onOpenSubmission,
  onNavigate,
}: {
  currentUserId: string
  isAdmin: boolean
  isSuperAdmin: boolean
  submissions: Submission[] | null
  onOpenSubmission: (submissionId: string) => void
  onNavigate: (page: string) => void
}) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [roster, setRoster] = useState<RosterLink[]>([])
  const [tasks, setTasks] = useState<AssessmentTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    Promise.all([listAssignments(), listPeople(), listRoster(), listTasks()])
      .then(([a, p, r, t]) => {
        setAssignments(a)
        setPeople(p)
        setRoster(r)
        setTasks(t)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [version])

  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name ?? "Unknown"
  // Admins assign any student; tutors only their own.
  const learners = people.filter((p) => p.role === "student" && (isAdmin || tutorOf(roster, p.id) === currentUserId))

  const run = async (action: () => Promise<void>) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // One card per task + due date, like a Classroom assignment.
  const groups = new Map<string, Assignment[]>()
  for (const a of assignments ?? []) {
    const key = `${a.task_id}|${a.due_at ?? ""}`
    groups.set(key, [...(groups.get(key) ?? []), a])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Assign speaking tasks, track who turned them in, and grade.</p>
        <button onClick={() => setCreating(true)} className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white">
          + Create assignment
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {!assignments && !error && <p className="text-sm text-slate-500">Loading classwork…</p>}

      {assignments && !assignments.length && (
        <SetupChecklist
          hasTasks={tasks.length > 0}
          hasLearners={learners.length > 0}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          onNavigate={onNavigate}
          onCreate={() => setCreating(true)}
        />
      )}

      {[...groups.values()].map((items) => (
        <AssignmentCard
          key={items[0].id}
          items={items}
          showTutor={isAdmin}
          nameOf={nameOf}
          submissions={submissions}
          onOpenSubmission={onOpenSubmission}
          run={run}
        />
      ))}

      {creating && (
        <Modal onClose={() => setCreating(false)}>
          <AssignForm
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            learners={learners}
            roster={roster}
            nameOf={nameOf}
            tasks={tasks}
            onCancel={() => setCreating(false)}
            onAssigned={(message) => {
              setCreating(false)
              setNotice(message)
              reload()
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function SetupChecklist({
  hasTasks,
  hasLearners,
  isAdmin,
  isSuperAdmin,
  onNavigate,
  onCreate,
}: {
  hasTasks: boolean
  hasLearners: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  onNavigate: (page: string) => void
  onCreate: () => void
}) {
  const link = "text-xs font-bold text-kez-blue"
  const steps = [
    {
      done: hasTasks,
      title: "Create a speaking task",
      action: (
        <button onClick={() => onNavigate("tasks")} className={link}>
          Go to Tasks →
        </button>
      ),
    },
    {
      done: hasLearners,
      title: isAdmin ? "Add student accounts" : "Have students assigned to you",
      action: isSuperAdmin ? (
        <button onClick={() => onNavigate("users")} className={link}>
          Go to Users →
        </button>
      ) : (
        <span className="text-xs text-slate-500">Ask an admin to set you as their tutor under Users.</span>
      ),
    },
    {
      done: false,
      title: "Assign the task with a due date",
      action: (
        <button onClick={onCreate} className={link}>
          Create assignment →
        </button>
      ),
    },
  ]

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-extrabold">No classwork yet</h2>
      <p className="mt-1 text-xs text-slate-500">Three steps to give your students their first assignment:</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                step.done ? "bg-green-50 text-green-700" : "bg-kez-blue-light text-kez-blue"
              }`}
              aria-label={step.done ? "Done" : `Step ${i + 1}`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <span className={`flex-1 text-sm font-semibold ${step.done ? "text-slate-500 line-through" : ""}`}>{step.title}</span>
            {!step.done && step.action}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onClick={onClose} role="presentation">
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}

function AssignmentCard({
  items,
  showTutor,
  nameOf,
  submissions,
  onOpenSubmission,
  run,
}: {
  items: Assignment[]
  showTutor: boolean
  nameOf: (id: string) => string
  submissions: Submission[] | null
  onOpenSubmission: (id: string) => void
  run: (action: () => Promise<void>) => void
}) {
  const first = items[0]
  const count = (state: string) => items.filter((a) => classworkState(a) === state).length
  const [open, setOpen] = useState(false)
  const [editingDue, setEditingDue] = useState(false)
  const [due, setDue] = useState(toLocalInput(first.due_at))

  return (
    <article className="rounded-3xl bg-white shadow-sm">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-3 p-6 text-left">
        <div className="min-w-0">
          <h2 className="font-extrabold">{first.task?.title ?? "Speaking task"}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Due {formatDue(first.due_at)} · {items.length} student{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{count("turned_in")} turned in</span>
          <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">{count("graded")} graded</span>
          <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{count("missing")} missing</span>
          <span className="text-slate-400" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6">
          {editingDue ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setEditingDue(false)
                const iso = due ? new Date(due).toISOString() : null
                run(async () => {
                  for (const a of items) await updateDueDate(a.id, iso)
                })
              }}
            >
              <input
              type="datetime-local"
              value={due}
              min={nowLocalInput()}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
            />
              <button type="submit" className="rounded-xl bg-kez-blue px-3 py-1.5 text-xs font-bold text-white">
                Save due date
              </button>
              <button type="button" onClick={() => setEditingDue(false)} className="text-xs font-bold text-slate-500">
                Cancel
              </button>
            </form>
          ) : (
            <button onClick={() => setEditingDue(true)} className="text-xs font-bold text-kez-blue">
              Change due date
            </button>
          )}
          <div className="mt-3">
            {items.map((a) => (
              <LearnerRow
                key={a.id}
                assignment={a}
                learnerName={nameOf(a.learner_id)}
                subtitle={showTutor ? `Tutor: ${nameOf(a.tutor_id)}` : null}
                submission={latestSubmissionFor(a, submissions)}
                onOpenSubmission={onOpenSubmission}
                run={run}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function LearnerRow({
  assignment,
  learnerName,
  subtitle,
  submission,
  onOpenSubmission,
  run,
}: {
  assignment: Assignment
  learnerName: string
  subtitle: string | null
  submission: Submission | null
  onOpenSubmission: (id: string) => void
  run: (action: () => Promise<void>) => void
}) {
  const state = classworkState(assignment)
  const suggestion = suggestedGrade(submission)
  const current = displayGrade(assignment)
  const [grade, setGrade] = useState(current?.toString() ?? suggestion?.toString() ?? "")
  const [edited, setEdited] = useState(false)
  // Recordings can finish loading after the row appears; fill in the suggestion
  // then, unless the tutor has already typed a grade.
  useEffect(() => {
    if (!edited && current === null && suggestion !== null) setGrade(suggestion.toString())
  }, [edited, current, suggestion])
  const canGrade = state !== "todo"

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-3">
      <div className="min-w-[10rem] flex-1">
        <b className="block text-sm">{learnerName}</b>
        {subtitle && <span className="block text-[11px] text-slate-500">{subtitle}</span>}
        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stateStyles[state]}`}>
          {stateLabels[state]}
          {current !== null && ` · ${current}/100`}
        </span>
        {suggestion !== null && state !== "graded" && (
          <span className="ml-2 text-[11px] text-slate-500">Machine-generated suggestion: {suggestion}</span>
        )}
      </div>
      {submission && (
        <button onClick={() => onOpenSubmission(submission.id)} className="rounded-xl bg-kez-blue-light px-3 py-1.5 text-xs font-bold text-kez-blue">
          Open recording
        </button>
      )}
      {canGrade && (
        <form
          className="flex items-center gap-1"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            const value = Number(grade)
            if (grade !== "" && value >= 0 && value <= 100) run(() => gradeAssignment(assignment.id, value))
          }}
        >
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={grade}
            onChange={(e) => {
              setEdited(true)
              setGrade(e.target.value)
            }}
            aria-label={`Grade for ${learnerName}`}
            className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
          />
          <button type="submit" className="rounded-xl bg-kez-blue px-3 py-1.5 text-xs font-bold text-white">
            {state === "graded" ? "Update" : "Grade"}
          </button>
        </form>
      )}
      <button
        onClick={() =>
          window.confirm(
            `Remove this assignment for ${learnerName}?\n\n` +
              (assignment.grade !== null ? `Their grade (${assignment.grade}/100) will be deleted. ` : "") +
              (submission ? "Their recording is kept as ungraded practice." : "They will no longer see it in their to-do list."),
          ) && run(() => deleteAssignment(assignment.id))
        }
        className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
      >
        Remove
      </button>
    </div>
  )
}

function AssignForm({
  currentUserId,
  isAdmin,
  learners,
  roster,
  nameOf,
  tasks,
  onCancel,
  onAssigned,
}: {
  currentUserId: string
  isAdmin: boolean
  learners: Person[]
  roster: RosterLink[]
  nameOf: (id: string) => string
  tasks: AssessmentTask[]
  onCancel: () => void
  onAssigned: (message: string) => void
}) {
  const [taskId, setTaskId] = useState("")
  const [learnerIds, setLearnerIds] = useState<string[]>([])
  const [due, setDue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => setLearnerIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!learnerIds.length) return setError("Choose at least one student.")
    if (due && new Date(due) <= new Date()) return setError("The due date must be in the future.")
    setSaving(true)
    setError(null)
    try {
      const { created, skipped } = await assignTask({
        task_id: taskId,
        // Each student's own tutor owns the work; an admin owns it when there's none.
        learners: learnerIds.map((id) => ({ learner_id: id, tutor_id: tutorOf(roster, id) ?? currentUserId })),
        due_at: due ? new Date(due).toISOString() : null,
      })
      onAssigned(
        `Assigned to ${created} student${created === 1 ? "" : "s"}. They were notified.` +
          (skipped
            ? ` ${skipped} skipped: they already have this task open (or, for a pre/post-assessment, already had it once).`
            : ""),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-extrabold">Create assignment</h2>
      <p className="mt-1 text-xs text-slate-500">Students get a notification. After the due date, work with no recording is marked Missing (0).</p>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="mt-4 space-y-3">
        <select required value={taskId} onChange={(e) => setTaskId(e.target.value)} className={input}>
          <option value="">Task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.kind})
            </option>
          ))}
        </select>
        <label className="block text-xs text-slate-500">
          Due date and time (optional)
          <input type="datetime-local" value={due} min={nowLocalInput()} onChange={(e) => setDue(e.target.value)} className={`${input} mt-1`} />
        </label>
        <fieldset>
          <legend className="text-xs text-slate-500">Students</legend>
          {learners.length > 1 && (
            <button
              type="button"
              onClick={() => setLearnerIds(learnerIds.length === learners.length ? [] : learners.map((l) => l.id))}
              className="mt-1 text-xs font-bold text-kez-blue"
            >
              {learnerIds.length === learners.length ? "Clear all" : "Select all"}
            </button>
          )}
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {learners.map((l) => {
              const tutor = tutorOf(roster, l.id)
              return (
                <label key={l.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <input type="checkbox" checked={learnerIds.includes(l.id)} onChange={() => toggle(l.id)} />
                  <span className="flex-1 truncate">{l.full_name}</span>
                  {isAdmin && <span className="shrink-0 text-[11px] text-slate-500">{tutor ? `Tutor: ${nameOf(tutor)}` : "No tutor"}</span>}
                </label>
              )
            })}
          </div>
          {!learners.length && (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              {isAdmin ? "No student accounts yet." : "No students are assigned to you yet. Ask an admin to set you as their tutor under Users."}
            </p>
          )}
        </fieldset>
        {!tasks.length && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">No speaking tasks yet. Create one under Tasks.</p>}
      </div>
      <div className="mt-5 flex gap-2">
        <button type="submit" disabled={saving} className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Assigning…" : "Assign"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  )
}
