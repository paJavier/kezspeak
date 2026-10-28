import { type ReactNode, useEffect, useState } from "react"
import { isProcessing, type Submission } from "../../lib/assessments"
import { roleLabels, type Role } from "../../lib/admin"
import { classworkState, listAssignments, listPeople, type Assignment, type Person } from "../../lib/classroom"
import { needsReview } from "../../lib/progress"

const RANGES = [
  { weeks: 4, label: "4 weeks" },
  { weeks: 12, label: "12 weeks" },
  { weeks: 26, label: "6 months" },
] as const

const DAY = 24 * 60 * 60 * 1000

// Monday 00:00 local time of the week containing `date`.
const weekStart = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

type Bucket = { start: Date; count: number }

/** Count dates per week for the last `weeks` weeks, oldest first. */
function weekly(dates: (string | null | undefined)[], weeks: number): Bucket[] {
  const first = weekStart(new Date(Date.now() - (weeks - 1) * 7 * DAY))
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: new Date(first.getTime() + i * 7 * DAY), count: 0 }))
  for (const value of dates) {
    if (!value) continue
    const index = Math.floor((weekStart(new Date(value)).getTime() - first.getTime()) / (7 * DAY) + 0.5)
    if (index >= 0 && index < weeks) buckets[index].count += 1
  }
  return buckets
}

const shortDate = (d: Date) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d)

/**
 * App-wide statistics: enrolments, recordings, processing and classwork.
 * Admins see everything; tutors see their own roster (RLS scopes the data).
 * Per-learner pre/post progress lives on the Progress page.
 */
export default function Statistics({
  submissions,
  error: submissionsError,
  isAdmin,
}: {
  submissions: Submission[] | null
  error: string | null
  isAdmin: boolean
}) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [weeks, setWeeks] = useState<number>(12)

  useEffect(() => {
    Promise.all([listPeople(), listAssignments()])
      .then(([p, a]) => {
        setPeople(p)
        setAssignments(a)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  const failure = error ?? submissionsError
  if (failure) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{failure}</p>
  if (!people || !assignments || !submissions) return <p className="text-slate-500">Loading statistics…</p>

  const since = weekStart(new Date(Date.now() - (weeks - 1) * 7 * DAY)).getTime()
  const inRange = (value: string | null | undefined) => !!value && new Date(value).getTime() >= since
  const hasJoinDates = people.some((p) => p.created_at)

  const learners = people.filter((p) => p.role === "student")
  const tutors = people.filter((p) => p.role === "tutor")
  const newLearners = learners.filter((p) => inRange(p.created_at))
  const recentRecordings = submissions.filter((s) => inRange(s.submitted_at))
  const scored = recentRecordings.filter((s) => s.evaluation)
  const avgScore = scored.length ? scored.reduce((sum, s) => sum + (s.evaluation?.predicted_score ?? 0), 0) / scored.length : null

  const states = assignments.map(classworkState)
  const closed = states.filter((s) => s !== "todo").length
  const done = states.filter((s) => s === "turned_in" || s === "graded").length

  const processing = [
    { label: "Completed", color: "var(--viz-good)", count: submissions.filter((s) => s.status === "completed").length },
    { label: "In progress", color: "var(--viz-warn)", count: submissions.filter((s) => isProcessing(s.status)).length },
    { label: "Failed", color: "var(--viz-crit)", count: submissions.filter((s) => s.status === "failed").length },
  ]
  const classwork = [
    { label: "Assigned", color: "var(--viz-neutral)", count: states.filter((s) => s === "todo").length },
    { label: "Turned in", color: "var(--viz-bar)", count: states.filter((s) => s === "turned_in").length },
    { label: "Graded", color: "var(--viz-good)", count: states.filter((s) => s === "graded").length },
    { label: "Missing", color: "var(--viz-crit)", count: states.filter((s) => s === "missing").length },
  ]

  const recentSignups = [...people]
    .filter((p) => p.created_at && p.role !== "super_admin")
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {isAdmin ? "Across the whole app." : "For the learners on your roster."} Individual pre/post progress is under Progress.
        </p>
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.weeks}
              onClick={() => setWeeks(r.weeks)}
              aria-pressed={weeks === r.weeks}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${weeks === r.weeks ? "bg-kez-blue text-white" : "text-slate-500"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={isAdmin ? "Learners" : "Your learners"}
          value={learners.length}
          note={hasJoinDates ? `+${newLearners.length} new in this period` : `${tutors.length} tutors`}
        />
        <Tile label="Recordings" value={recentRecordings.length} note={`${submissions.length} all time`} />
        <Tile label="Awaiting tutor review" value={submissions.filter(needsReview).length} note="Scored, no feedback yet" />
        <Tile
          label="Classwork turned in"
          value={closed ? `${Math.round((done / closed) * 100)}%` : "—"}
          note={`${classwork[3].count} missing · ${assignments.length} assigned in total`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="New learners per week">
          {hasJoinDates ? (
            <WeeklyBars buckets={weekly(newLearners.map((p) => p.created_at), weeks)} unit="new learner" />
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Apply supabase/migrations/20261029_statistics.sql to see sign-up dates.
            </p>
          )}
        </ChartCard>
        <ChartCard title="Recordings submitted per week">
          <WeeklyBars buckets={weekly(recentRecordings.map((s) => s.submitted_at), weeks)} unit="recording" />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Recording processing (all time)">
          <Breakdown parts={processing} />
        </ChartCard>
        <ChartCard title="Classwork status">
          <Breakdown parts={classwork} />
        </ChartCard>
        <ChartCard title="Average machine-generated score">
          <p className="text-4xl font-extrabold">{avgScore === null ? "—" : Math.round(avgScore)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Mean of {scored.length} scored recording{scored.length === 1 ? "" : "s"} in this period. The model is still being validated, so
            treat this as supporting information for tutors, not a measure of proficiency.
          </p>
        </ChartCard>
      </div>

      {isAdmin && hasJoinDates && (
        <ChartCard title="Recent sign-ups">
          {!recentSignups.length ? (
            <p className="text-sm text-slate-500">No accounts yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Role</th>
                  <th className="pb-2 text-right font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2.5 font-semibold">{p.full_name}</td>
                    <td className="py-2.5 text-slate-500">{roleLabels[p.role as Role] ?? p.role}</td>
                    <td className="py-2.5 text-right text-slate-500">{shortDate(new Date(p.created_at!))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
      )}
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

/** Single-series weekly columns with a hover/focus readout and a table view. */
function WeeklyBars({ buckets, unit }: { buckets: Bucket[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`
  const shown = active === null ? null : buckets[active]
  const labelEvery = Math.ceil(buckets.length / 6)

  return (
    <div>
      <p className="h-5 text-xs text-slate-500" aria-live="polite">
        {shown ? (
          <>
            Week of {shortDate(shown.start)}: <b className="text-slate-700">{plural(shown.count)}</b>
          </>
        ) : (
          <>
            <b className="text-slate-700">{plural(total)}</b> in this period
          </>
        )}
      </p>
      <div className="relative ml-6 mt-3 h-40">
        {/* Recessive gridlines at 0, half and max. */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t" style={{ bottom: `${f * 100}%`, borderColor: "var(--viz-grid)" }}>
            <span className="absolute -top-2 right-full pr-1 text-[10px] text-slate-400">{Math.round(f * max)}</span>
          </div>
        ))}
        <div className="absolute inset-0 ml-1 flex items-end gap-[2px]">
          {buckets.map((b, i) => (
            <button
              key={b.start.toISOString()}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`Week of ${shortDate(b.start)}: ${plural(b.count)}`}
              className="flex h-full flex-1 items-end rounded-t outline-none focus-visible:ring-2 focus-visible:ring-kez-blue"
            >
              <span
                className="block w-full rounded-t transition-opacity"
                style={{
                  height: b.count ? `${(b.count / max) * 100}%` : 0,
                  minHeight: b.count ? 3 : 0,
                  background: "var(--viz-bar)",
                  opacity: active === null || active === i ? 1 : 0.45,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="ml-7 mt-2 flex gap-[2px] text-[10px] text-slate-400">
        {buckets.map((b, i) => (
          <span key={b.start.toISOString()} className="flex-1 truncate text-center">
            {i % labelEvery === 0 ? shortDate(b.start) : ""}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer font-bold">View as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {buckets.map((b) => (
              <tr key={b.start.toISOString()} className="border-t border-slate-100">
                <td className="py-1">Week of {shortDate(b.start)}</td>
                <td className="py-1 text-right font-semibold text-slate-700">{b.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/** Part-to-whole bar; every segment is also listed with its label and count. */
function Breakdown({ parts }: { parts: { label: string; color: string; count: number }[] }) {
  const total = parts.reduce((sum, p) => sum + p.count, 0)
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-slate-100">
        {total > 0 &&
          parts
            .filter((p) => p.count)
            .map((p) => (
              <span
                key={p.label}
                title={`${p.label}: ${p.count}`}
                style={{ width: `${(p.count / total) * 100}%`, background: p.color }}
              />
            ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="flex-1 text-slate-600">{p.label}</span>
            <b>{p.count}</b>
            <span className="w-10 text-right text-xs text-slate-400">{total ? `${Math.round((p.count / total) * 100)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
