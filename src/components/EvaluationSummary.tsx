import type { Evaluation, TutorFeedback } from "../lib/assessments"

const fmt = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined ? "—" : value.toFixed(digits)

/**
 * Machine results + measured speaking features. The score comes from an
 * experimental model (audio-only XGBoost, R² near zero on L2-ARCTIC), so it is
 * always labelled as an estimate awaiting tutor review.
 */
export default function EvaluationSummary({
  evaluation,
  feedback,
  audience = "learner",
}: {
  evaluation: Evaluation
  feedback: TutorFeedback | null
  audience?: "learner" | "tutor"
}) {
  const a = evaluation.acoustic_features
  const n = evaluation.nlp_features
  const pauseShare = a.duration > 0 ? ((a.duration - a.speech_duration) / a.duration) * 100 : null
  const metrics: [string, string, string][] = [
    ["Speech rate", fmt(a.speech_rate), "words per minute"],
    ["Pauses", fmt(a.pause_count), `avg ${fmt(a.avg_pause, 1)}s · longest ${fmt(a.max_pause, 1)}s`],
    ["Time spent silent", pauseShare === null ? "—" : `${fmt(pauseShare)}%`, "of the recording"],
    ["Words spoken", fmt(n.word_count), `${fmt(n.unique_words)} different words`],
    ["Lexical diversity", fmt(n.mattr, 2), "MATTR, 0–1 (higher = more varied)"],
    ["Grammar issues", n.grammar_errors === null ? "n/a" : fmt(n.grammar_errors), "flagged by LanguageTool"],
    ["Sentence length", fmt(n.avg_sentence_length, 1), "words per sentence"],
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-kez-blue p-6 text-white">
          <p className="text-xs font-bold tracking-wider text-kez-yellow">MACHINE ESTIMATE</p>
          <p className="mt-3 text-5xl font-extrabold">
            {fmt(evaluation.predicted_score)}
            <span className="text-lg text-blue-200"> / 100</span>
          </p>
          <p className="mt-3 text-xs leading-5 text-blue-100">
            Experimental pronunciation estimate. Pending tutor review, not a final grade.
          </p>
        </div>
        <div className="rounded-3xl bg-kez-yellow-light p-6">
          <p className="text-xs font-bold tracking-wider text-amber-800">TUTOR SCORE</p>
          {feedback ? (
            <>
              <p className="mt-3 text-5xl font-extrabold text-kez-dark">
                {feedback.adjusted_score === null ? fmt(evaluation.predicted_score) : fmt(feedback.adjusted_score)}
                <span className="text-lg text-amber-700"> / 100</span>
              </p>
              <p className="mt-3 text-xs text-amber-900">
                {feedback.adjusted_score === null
                  ? "Tutor confirmed the estimate."
                  : audience === "tutor"
                    ? "Adjusted by the tutor."
                    : "Adjusted by your tutor."}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-amber-900">
              {audience === "tutor"
                ? "Not reviewed yet. Confirm or adjust the estimate below."
                : "Waiting for your tutor to review this recording."}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-kez-dark">{value}</p>
            <p className="text-[11px] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="font-extrabold">Transcript</h3>
        <p className="mt-1 text-[11px] text-slate-400">Generated automatically by Whisper. It may contain mistakes.</p>
        <p className="mt-3 text-sm leading-7 text-slate-600">“{evaluation.transcript}”</p>
      </div>

      {feedback && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="font-extrabold">Tutor feedback</h3>
          <p className="mt-3 text-sm leading-7 text-slate-700">{feedback.comment}</p>
          {(feedback.strengths || feedback.improvements) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {feedback.strengths && (
                <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-900">
                  <b className="block text-xs text-green-700">STRENGTHS</b>
                  {feedback.strengths}
                </div>
              )}
              {feedback.improvements && (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <b className="block text-xs text-amber-700">TO WORK ON</b>
                  {feedback.improvements}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
