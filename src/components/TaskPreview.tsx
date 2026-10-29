import { useEffect, type ReactNode } from "react"
import { Eye, X } from "lucide-react"
import type { AssessmentTask, TaskKind } from "../lib/assessments"
import { formatDue } from "../lib/classroom"
import { Mic } from "./icons"

const kindLabels: Record<TaskKind, string> = { pre: "Pre-Assessment", post: "Post-Assessment", practice: "Practice" }

type PreviewTask = Pick<AssessmentTask, "title" | "prompt" | "kind" | "duration_seconds" | "skill_focus" | "prep_seconds">

/**
 * Shows a task the way a student will see it, before a tutor creates the task
 * or assigns it. Read-only: nothing is saved until `onConfirm` runs.
 * Pass `dueAt` (null = no due date) to include the "Assigned to you" card.
 */
export default function TaskPreview({
  task,
  dueAt,
  note,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  task: PreviewTask
  dueAt?: string | null
  note?: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  useEffect(() => {
    // Capture phase + stopPropagation: Escape closes only this preview, not a
    // dialog underneath it (Classwork's "Create assignment" modal).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/50 p-4" onClick={onClose} role="presentation">
      <div
        className="mx-auto my-6 w-full max-w-2xl rounded-3xl bg-[#f8fbff] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-preview-heading"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 p-5 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kez-blue-light text-kez-blue"><Eye size={19} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="task-preview-heading" className="font-extrabold text-kez-dark">Student preview</h2>
            <p className="text-xs text-slate-500">This is how students will see it. Nothing is saved yet.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          {dueAt !== undefined && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Assigned to you</h3>
              <article className="mt-2 flex max-w-xs flex-col rounded-3xl bg-white p-5 shadow-sm">
                <span className="w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-kez-blue">Assigned</span>
                <h4 className="mt-3 font-extrabold text-kez-dark">{task.title || "Untitled task"}</h4>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-500">{task.prompt}</p>
                <p className="mt-3 text-xs font-bold text-slate-700">Due {formatDue(dueAt)}</p>
                <span className="mt-5 w-full rounded-xl bg-kez-blue py-3 text-center text-sm font-bold text-white">Start</span>
              </article>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Recording screen</h3>
            <div className="mt-2 rounded-3xl bg-white p-6 text-center shadow-sm">
              <span className="rounded-full bg-kez-blue-light px-3 py-1 text-[11px] font-bold text-kez-blue">
                {kindLabels[task.kind]}{task.skill_focus ? ` · ${task.skill_focus}` : ""}
              </span>
              <h4 className="mt-4 text-xl font-extrabold text-kez-dark">{task.title || "Untitled task"}</h4>
              <p className="mt-3 whitespace-pre-line text-left text-base leading-7 text-slate-600 sm:text-center">{task.prompt}</p>
              <span className="mt-6 inline-block rounded-full bg-kez-yellow-light px-4 py-2 text-sm font-bold text-amber-800">
                {task.prep_seconds ? `${task.prep_seconds}s to prepare · ` : ""}Up to {task.duration_seconds} seconds
              </span>
              <div className="mx-auto mt-5 grid size-24 place-items-center rounded-full bg-kez-blue text-kez-yellow" aria-hidden="true">
                <Mic size={36} />
              </div>
            </div>
          </section>

          {note && <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-slate-600 shadow-sm">{note}</div>}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-5 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600">
            Keep editing
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
