import ChangePasswordForm from "./ChangePasswordForm"

/** Shown after an invite or password-reset email link, before the dashboard. */
export default function SetPasswordScreen({ name, invited, onDone }: { name: string; invited: boolean; onDone: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-kez-blue-light px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-kez-blue">KezSpeak</p>
        <h1 className="mt-2 text-2xl font-extrabold">{invited ? `Welcome, ${name}!` : "Choose a new password"}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {invited
            ? "Your account is ready. Choose a password you'll use to log in."
            : "Enter a new password for your account."}
        </p>
        <div className="mt-6">
          <ChangePasswordForm submitLabel={invited ? "Set password & continue" : "Save & continue"} onDone={onDone} />
        </div>
      </section>
    </div>
  )
}
