import { useEffect, useState } from "react"
import type { Submission } from "../lib/assessments"
import { fetchMyTutor } from "../lib/classroom"
import type { Profile } from "../lib/supabase"
import ChangePasswordForm from "./ChangePasswordForm"
import ExamGoalCard from "./ExamGoalCard"

const roleLabels: Record<Profile["role"], string> = {
  student: "Learner",
  tutor: "Tutor / Teacher",
  admin: "Moderator",
  super_admin: "Administrator",
}

/** The signed-in user's real profile plus a couple of counts from their data. */
export default function ProfileCard({ profile, submissions }: { profile: Profile; submissions: Submission[] | null }) {
  const isLearner = profile.role === "student"
  // Learners see who their tutor is (set by a super admin on the Users page).
  const [tutor, setTutor] = useState<string>("Loading…")
  useEffect(() => {
    if (!isLearner) return
    let active = true
    fetchMyTutor(profile.id)
      .then((person) => { if (active) setTutor(person?.full_name ?? "Not assigned yet") })
      .catch(() => { if (active) setTutor("Couldn't load") })
    return () => { active = false }
  }, [isLearner, profile.id])
  const list = submissions ?? []
  const stats: [string, string][] = isLearner
    ? [
        ["RECORDINGS", String(list.length)],
        ["ANALYZED", String(list.filter((s) => s.status === "completed").length)],
      ]
    : [
        ["LEARNERS", String(new Set(list.map((s) => s.learner_id)).size)],
        ["REVIEWED", String(list.filter((s) => s.feedback).length)],
      ]
  const details: [string, string][] = [
    ["Full name", profile.full_name ?? "—"],
    ["Email", profile.email ?? "—"],
    ["Role", roleLabels[profile.role]],
    ...(isLearner ? [["Tutor", tutor] as [string, string]] : []),
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-col items-center gap-6 rounded-3xl bg-white p-6 text-center shadow-sm sm:flex-row sm:p-8 sm:text-left">
        <span className="grid size-24 shrink-0 place-items-center rounded-full bg-kez-yellow text-4xl font-bold text-kez-dark">
          {profile.full_name?.[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-kez-dark">{profile.full_name}</h2>
          <p className="break-all text-slate-500">{profile.email}</p>
          <span className="mt-3 inline-block rounded-full bg-kez-blue-light px-3 py-1 text-xs font-bold text-kez-blue">
            {roleLabels[profile.role]}
          </span>
        </div>
        <div className="grid w-full grid-cols-2 gap-4 sm:ml-auto sm:w-auto">
          {stats.map(([label, value], i) => (
            <div key={label} className={`min-w-32 rounded-2xl p-4 text-left ${i === 0 ? "bg-kez-blue-light" : "bg-kez-yellow-light"}`}>
              <p className={`text-xs font-bold ${i === 0 ? "text-kez-blue" : "text-amber-800"}`}>{label}</p>
              <p className="mt-2 text-2xl font-extrabold text-kez-dark">{submissions ? value : "…"}</p>
            </div>
          ))}
        </div>
      </section>

      {isLearner && <ExamGoalCard learnerId={profile.id} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h3 className="font-extrabold text-kez-dark">Account details</h3>
          <dl className="mt-4 divide-y divide-slate-100">
            {details.map(([term, value]) => (
              <div key={term} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <dt className="text-slate-500">{term}</dt>
                <dd className="min-w-0 break-all font-bold text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-400">To change your name or role, ask an administrator.{isLearner && " An administrator also sets your tutor."}</p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h3 className="font-extrabold text-kez-dark">Change password</h3>
          <p className="mb-4 mt-1 text-xs text-slate-500">You'll use the new password next time you log in.</p>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  )
}
