import { useState } from "react"
import type { Submission } from "../../lib/assessments"
import { formatChange, formatScore, relativeDate, statusStyles, summarizeLearners } from "../../lib/progress"

const FILTERS = ["All", "Needs review", "Improving", "Needs attention", "Not assessed yet"] as const

/** One row per learner the tutor can see, with real pre/post scores. */
export default function LearnerOverview({
  submissions,
  error,
  onOpen,
}: {
  submissions: Submission[] | null
  error: string | null
  onOpen: (learnerId: string) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All")

  if (error) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{error}</p>
  if (!submissions) return <p className="text-slate-500">Loading learners…</p>

  const q = query.trim().toLowerCase()
  const rows = summarizeLearners(submissions).filter(
    (l) => (filter === "All" || l.status === filter) && (!q || l.name.toLowerCase().includes(q)),
  )

  return (
    <>
      <p className="text-slate-500">Monitor speaking performance and provide targeted feedback.</p>
      <div className="mt-6 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learners..."
          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-kez-blue sm:w-72"
        />
        {FILTERS.map((x) => (
          <button
            key={x}
            onClick={() => setFilter(x)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === x ? "bg-kez-blue text-white" : "bg-white text-slate-500"}`}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {["Learner", "Pre-Assessment", "Post-Assessment", "Change", "Last Activity", "Status", ""].map((x) => (
                <th className="px-6 py-5" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.learnerId} className="border-b border-slate-50">
                <td className="px-6 py-5 font-bold">{l.name}</td>
                <td className="px-6 py-5 text-slate-600">{formatScore(l.journey.preScore)}</td>
                <td className="px-6 py-5 text-slate-600">{formatScore(l.journey.postScore)}</td>
                <td className="px-6 py-5 text-slate-600">{formatChange(l.journey.comparison.scoreChange)}</td>
                <td className="px-6 py-5 text-slate-600">{relativeDate(l.lastActivity)}</td>
                <td className="px-6 py-5">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[l.status]}`}>{l.status}</span>
                </td>
                <td className="px-6 py-5">
                  <button onClick={() => onOpen(l.learnerId)} className="font-bold text-kez-blue">
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  {submissions.length ? "No learners match." : "No learners yet. Learners appear here once they’re assigned to you and submit a recording."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
