import type { AiFeedback } from "../lib/assessments"

/** Gemini fallback feedback. Visibly separate from the model's assessment. */
export default function AiFeedbackCard({ feedback }: { feedback: AiFeedback }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/60 p-6 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold tracking-wider text-white">
          AI-GENERATED FEEDBACK
        </span>
        <span className="text-xs text-violet-700">
          Not part of your assessment score · {feedback.provider} {feedback.model}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-700">{feedback.summary}</p>
      {(feedback.strengths.length > 0 || feedback.improvements.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {feedback.strengths.length > 0 && (
            <div className="rounded-2xl bg-white p-4 text-sm">
              <b className="text-xs text-green-700">WHAT WENT WELL</b>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {feedback.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.improvements.length > 0 && (
            <div className="rounded-2xl bg-white p-4 text-sm">
              <b className="text-xs text-amber-700">TRY NEXT TIME</b>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {feedback.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {feedback.transcript && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-bold text-violet-700">Transcript (from Gemini)</summary>
          <p className="mt-2 leading-7 text-slate-600">“{feedback.transcript}”</p>
        </details>
      )}
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Our scoring service couldn’t analyze this recording, so this feedback was written by Google Gemini. Your
        tutor will still review your recording, and it can be scored once the service is back.
      </p>
    </div>
  )
}
