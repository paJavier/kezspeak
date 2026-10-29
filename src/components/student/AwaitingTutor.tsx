import { Bell, Hourglass, User } from "lucide-react"

/**
 * Shown to a student who has no tutor yet. Tasks, classwork and recordings
 * unlock once a super admin sets their tutor on the Users page; the database
 * enforces the same rule (migration 20261103_require_tutor.sql).
 */
export default function AwaitingTutor({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <section className="mb-6 rounded-3xl bg-white p-6 text-center shadow-sm sm:p-10">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-800">
        <Hourglass size={26} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold text-kez-dark">You're almost ready</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        The Kez team will assign your tutor soon. Your speaking activities and assessments unlock as soon as they do, and
        you'll get a notification when work is assigned to you.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate("notifications")}
          className="inline-flex items-center gap-2 rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white"
        >
          <Bell size={16} aria-hidden="true" /> Notifications
        </button>
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="inline-flex items-center gap-2 rounded-xl bg-kez-blue-light px-5 py-3 text-sm font-bold text-kez-blue"
        >
          <User size={16} aria-hidden="true" /> Your profile
        </button>
      </div>
    </section>
  )
}
