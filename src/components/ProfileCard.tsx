import type { Submission } from "../lib/assessments"
import type { Profile } from "../lib/supabase"
import ChangePasswordForm from "./ChangePasswordForm"

const roleLabels: Record<Profile["role"], string> = {
  student: "Learner",
  tutor: "Tutor / Teacher",
  admin: "Staff",
  super_admin: "Administrator",
}

/** The signed-in user's real profile plus a couple of counts from their data. */
export default function ProfileCard({ profile, submissions }: { profile: Profile; submissions: Submission[] | null }) {
  const isLearner = profile.role === "student"
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

  return (
    <section className="max-w-xl rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <span className="grid size-20 place-items-center rounded-full bg-kez-yellow text-3xl font-bold">
        {profile.full_name?.[0]?.toUpperCase() ?? "?"}
      </span>
      <h2 className="mt-5 text-2xl font-extrabold">{profile.full_name}</h2>
      <p className="break-all text-slate-500">{profile.email}</p>
      <span className="mt-3 inline-block rounded-full bg-kez-blue-light px-3 py-1 text-xs font-bold text-kez-blue">
        {roleLabels[profile.role]}
      </span>
      <div className="mt-7 grid grid-cols-2 gap-4">
        {stats.map(([label, value], i) => (
          <div key={label} className={`rounded-2xl p-4 ${i === 0 ? "bg-kez-blue-light" : "bg-kez-yellow-light"}`}>
            <p className={`text-xs font-bold ${i === 0 ? "text-kez-blue" : "text-amber-800"}`}>{label}</p>
            <p className="mt-2 text-2xl font-extrabold">{submissions ? value : "…"}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 border-t border-slate-100 pt-6">
        <h3 className="font-extrabold">Change password</h3>
        <p className="mb-4 mt-1 text-xs text-slate-500">You'll use the new password next time you log in.</p>
        <ChangePasswordForm />
      </div>
    </section>
  )
}
