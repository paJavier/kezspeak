import type { Evaluation } from "../../lib/assessments"
import {
  EXAM_IDS,
  EXAMS,
  evidenceFor,
  formatExamScore,
  overallFor,
  PRACTICE_ESTIMATE_NOTE,
  scoreOptions,
  type ExamId,
} from "../../lib/exams"

export type RubricDraft = {
  exam: ExamId | null
  scores: Record<string, number>
  notes: Record<string, string>
}

/**
 * The tutor's exam-style rubric for one recording. Each criterion shows the
 * matching machine features as evidence only; the tutor decides the score.
 */
export default function RubricPanel({
  draft,
  onChange,
  evaluation,
  goalExam,
  required,
}: {
  draft: RubricDraft
  onChange: (draft: RubricDraft) => void
  evaluation: Evaluation | null
  /** The learner's goal exam; null when they haven't set one. */
  goalExam: ExamId | null
  required: boolean
}) {
  const exam = draft.exam ? EXAMS[draft.exam] : null
  const overall = draft.exam ? overallFor({ exam: draft.exam, scores: draft.scores }) : null

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 p-4" aria-labelledby="rubric-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="rubric-heading" className="text-sm font-extrabold text-kez-dark">
          Exam rubric {required ? <span className="text-red-600">*</span> : <span className="font-medium text-slate-400">(optional)</span>}
        </h3>
        <select
          value={draft.exam ?? ""}
          onChange={(e) => onChange({ exam: (e.target.value || null) as ExamId | null, scores: {}, notes: {} })}
          aria-label="Exam"
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 outline-none focus:border-kez-blue"
        >
          <option value="">No exam rubric</option>
          {EXAM_IDS.map((id) => (
            <option key={id} value={id}>
              {EXAMS[id].shortName}
              {id === goalExam ? " (learner's goal)" : ""}
            </option>
          ))}
        </select>
      </div>
      {!goalExam && (
        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          This learner has no exam goal yet. Set one on their progress page (Learners) so pre/post tests use the same exam.
        </p>
      )}

      {exam && (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2 rounded-xl bg-kez-blue-light px-3 py-2">
            <span className="text-xs font-bold text-kez-blue">{exam.shortName} practice estimate</span>
            <b className="text-lg text-kez-blue">{formatExamScore(exam.id, overall)}</b>
          </div>
          <div className="mt-3 space-y-4">
            {exam.criteria.map((criterion) => {
              const evidence = evidenceFor(criterion, evaluation)
              return (
                <fieldset key={criterion.key}>
                  <legend className="text-xs font-bold text-slate-700">{criterion.label}</legend>
                  <p className="text-[11px] leading-4 text-slate-500">{criterion.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label={`${criterion.label} score`}>
                    {scoreOptions(exam.id).map((value) => {
                      const selected = draft.scores[criterion.key] === value
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onChange({ ...draft, scores: { ...draft.scores, [criterion.key]: value } })}
                          className={`size-8 rounded-lg text-xs font-bold ${selected ? "bg-kez-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-kez-blue-light"}`}
                        >
                          {value}
                        </button>
                      )
                    })}
                  </div>
                  {evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {evidence.map((chip) => (
                        <span key={chip} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    value={draft.notes[criterion.key] ?? ""}
                    maxLength={300}
                    onChange={(e) => onChange({ ...draft, notes: { ...draft.notes, [criterion.key]: e.target.value } })}
                    placeholder={`Note on ${criterion.label.toLowerCase()} (optional)`}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-kez-blue"
                  />
                </fieldset>
              )
            })}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">
            Machine features are evidence only. {PRACTICE_ESTIMATE_NOTE}
          </p>
        </>
      )}
    </section>
  )
}
