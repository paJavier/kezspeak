import { useEffect, useState, type FormEvent } from "react"
import { Target } from "lucide-react"
import { cambridgeLevels, EXAM_IDS, EXAMS, formatExamScore, TRADEMARK_NOTE, type CambridgeLevel, type ExamId } from "../lib/exams"
import { fetchGoal, saveGoal, type LearnerGoal } from "../lib/goals"

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-kez-blue"
const label = "block text-xs font-bold text-slate-600"

/** "IELTS · target 7.0 · exam 12 Mar 2027" */
export function describeGoal(goal: LearnerGoal): string {
  const exam = EXAMS[goal.exam]
  const parts = [goal.exam === "cambridge" && goal.cambridge_level ? `${exam.shortName} ${cambridgeLevels[goal.cambridge_level]}` : exam.shortName]
  if (goal.target_score !== null) parts.push(`target ${formatExamScore(goal.exam, goal.target_score)}`)
  if (goal.exam_date) parts.push(`exam ${new Date(`${goal.exam_date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}`)
  return parts.join(" · ")
}

/**
 * View and edit a learner's exam goal. The learner sets their own; their tutor
 * and admins can change it too (RLS in 20261104_exam_goals.sql).
 */
export default function ExamGoalCard({
  learnerId,
  learnerName,
  onChange,
  compact = false,
}: {
  learnerId: string
  /** Shown to tutors ("Ana's exam goal"); omit for the learner's own view. */
  learnerName?: string
  onChange?: (goal: LearnerGoal | null) => void
  compact?: boolean
}) {
  const [goal, setGoal] = useState<LearnerGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<{ exam: ExamId; level: CambridgeLevel; target: string; date: string }>({
    exam: "ielts",
    level: "b2",
    target: "",
    date: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchGoal(learnerId)
      .then((g) => {
        if (!active) return
        setGoal(g)
        setError(null)
        onChange?.(g)
      })
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
    // onChange is a notification callback; reloading only depends on the learner.
  }, [learnerId])

  const startEditing = () => {
    setForm({
      exam: goal?.exam ?? "ielts",
      level: goal?.cambridge_level ?? "b2",
      target: goal?.target_score?.toString() ?? "",
      date: goal?.exam_date ?? "",
    })
    setEditing(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const next: LearnerGoal = {
      learner_id: learnerId,
      exam: form.exam,
      cambridge_level: form.exam === "cambridge" ? form.level : null,
      target_score: form.target ? Number(form.target) : null,
      exam_date: form.date || null,
    }
    try {
      await saveGoal(next)
      setGoal(next)
      onChange?.(next)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const heading = learnerName ? `${learnerName}'s exam goal` : "My exam goal"

  return (
    <section className={`rounded-3xl bg-white shadow-sm ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kez-blue-light text-kez-blue">
          <Target size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-kez-dark">{heading}</h3>
          {loading ? (
            <p className="mt-1 text-sm text-slate-500">Loading…</p>
          ) : goal ? (
            <p className="mt-1 text-sm font-bold text-kez-blue">{describeGoal(goal)}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              {learnerName ? "No goal yet. Set one so pre/post tests are scored on the right exam rubric." : "Which speaking exam are you preparing for? Your tutor will score your pre- and post-tests on that exam's criteria."}
            </p>
          )}
        </div>
        {!loading && !editing && !error?.includes("apply supabase") && (
          <button type="button" onClick={startEditing} className="rounded-xl bg-kez-blue-light px-4 py-2 text-sm font-bold text-kez-blue">
            {goal ? "Edit" : "Set goal"}
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

      {editing && (
        <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className={label}>Exam
            <select value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value as ExamId, target: "" })} className={`${input} mt-1`}>
              {EXAM_IDS.map((id) => <option key={id} value={id}>{EXAMS[id].name}</option>)}
            </select>
          </label>
          {form.exam === "cambridge" && (
            <label className={label}>Level
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as CambridgeLevel })} className={`${input} mt-1`}>
                {(Object.keys(cambridgeLevels) as CambridgeLevel[]).map((l) => <option key={l} value={l}>{cambridgeLevels[l]}</option>)}
              </select>
            </label>
          )}
          <label className={label}>Target score <span className="font-medium text-slate-400">({EXAMS[form.exam].unit})</span>
            <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className={`${input} mt-1`}>
              <option value="">Not sure yet</option>
              {EXAMS[form.exam].targets.map((t) => <option key={t} value={t}>{formatExamScore(form.exam, t)}</option>)}
            </select>
          </label>
          <label className={label}>Exam date <span className="font-medium text-slate-400">(optional)</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${input} mt-1`} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-kez-blue px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save goal"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
          </div>
          <p className="text-[11px] text-slate-400 sm:col-span-2">{TRADEMARK_NOTE}</p>
        </form>
      )}
    </section>
  )
}
