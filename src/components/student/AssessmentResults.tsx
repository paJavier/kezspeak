import { useEffect, useState } from "react"
import useSubmission from "../../hooks/useSubmission"
import {
  comparePrePost,
  finalScore,
  listSubmissions,
  statusLabels,
  type Submission,
} from "../../lib/assessments"
import AudioPlayer from "../AudioPlayer"
import EvaluationSummary from "../EvaluationSummary"
import ProcessingStatus from "../ProcessingStatus"

const kindLabels = { pre: "Pre-Assessment", post: "Post-Assessment", practice: "Practice" }

const fmt = (value: number | null, digits = 1) => (value === null ? "—" : value.toFixed(digits))

const signed = (value: number | null, digits = 1) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`

function Comparison({ submissions }: { submissions: Submission[] }) {
  const { pre, post, scoreChange, percentChange, metrics } = comparePrePost(submissions)
  if (!pre && !post) return null

  return (
    <section className="rounded-3xl bg-white p-7 shadow-sm">
      <p className="text-sm font-bold text-kez-blue">PRE vs POST ASSESSMENT</p>
      <p className="mt-1 text-xs text-slate-500">Machine-generated estimate, reviewed by your tutor. Not an official proficiency level.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-kez-blue-light p-5">
          <p className="text-xs font-bold text-slate-500">Pre-assessment</p>
          <p className="mt-1 text-3xl font-extrabold">{pre ? fmt(finalScore(pre), 0) : "—"}</p>
        </div>
        <div className="rounded-2xl bg-kez-blue-light p-5">
          <p className="text-xs font-bold text-slate-500">Post-assessment</p>
          <p className="mt-1 text-3xl font-extrabold">{post ? fmt(finalScore(post), 0) : "Not taken yet"}</p>
        </div>
        <div className="rounded-2xl bg-green-50 p-5">
          <p className="text-xs font-bold text-green-700">Change</p>
          <p className="mt-1 text-3xl font-extrabold text-green-800">{signed(scoreChange)}</p>
          <p className="text-xs text-green-700">{percentChange === null ? "" : `${signed(percentChange)}%`}</p>
        </div>
      </div>
      {pre && post && (
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2">Measure</th>
              <th className="py-2">Pre</th>
              <th className="py-2">Post</th>
              <th className="py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-t border-slate-100">
                <td className="py-2 font-semibold">
                  {m.label} {m.unit && <span className="text-xs text-slate-400">({m.unit})</span>}
                </td>
                <td className="py-2">{fmt(m.pre)}</td>
                <td className="py-2">{fmt(m.post)}</td>
                <td className="py-2 font-bold">
                  {m.pre === null || m.post === null ? "—" : signed(m.post - m.pre)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 text-xs text-slate-400">
        Scores use your tutor’s adjusted score when available, otherwise the experimental machine estimate.
      </p>
    </section>
  )
}

function SubmissionDetail({ id }: { id: string }) {
  const { submission, error, refresh } = useSubmission(id)
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
  if (!submission) return <p className="text-slate-500">Loading…</p>
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-bold text-slate-400">{submission.task ? kindLabels[submission.task.kind] : ""}</p>
        <h2 className="mt-1 text-xl font-extrabold">{submission.task?.title}</h2>
        <div className="mt-4">
          <AudioPlayer path={submission.audio_path} />
        </div>
      </div>
      {submission.status === "completed" && submission.evaluation ? (
        <EvaluationSummary evaluation={submission.evaluation} feedback={submission.feedback} />
      ) : (
        <ProcessingStatus submission={submission} onRetried={refresh} />
      )}
    </div>
  )
}

/** The learner's real results: pre/post comparison, history, and per-recording detail. */
export default function AssessmentResults({
  learnerId,
  onRecord,
}: {
  learnerId: string
  onRecord: () => void
}) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    listSubmissions(learnerId)
      .then((list) => {
        setSubmissions(list)
        setSelected((current) => current ?? list[0]?.id ?? null)
      })
      .catch((err: Error) => setError(err.message))
  }, [learnerId])

  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading your results…</p>
  if (!submissions.length)
    return (
      <section className="max-w-xl rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-extrabold">No recordings yet</h2>
        <p className="mt-2 text-slate-500">Record your first speaking task to see your results here.</p>
        <button onClick={onRecord} className="mt-6 rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white">
          🎤 Start a speaking task
        </button>
      </section>
    )

  return (
    <div className="space-y-6">
      <Comparison submissions={submissions} />
      <div className="grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="px-2 font-extrabold">My recordings</h2>
          <ul className="mt-3 space-y-1">
            {submissions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left ${s.id === selected ? "bg-kez-blue-light" : "hover:bg-slate-50"
                    }`}
                >
                  <span>
                    <b className="block text-sm">{s.task?.title ?? "Speaking task"}</b>
                    <span className="text-xs text-slate-500">
                      {s.task ? kindLabels[s.task.kind] : ""} · {new Date(s.submitted_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="text-right text-sm font-extrabold text-kez-blue">
                    {s.status === "completed" ? fmt(finalScore(s), 0) : statusLabels[s.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selected && <SubmissionDetail key={selected} id={selected} />}
      </div>
    </div>
  )
}
