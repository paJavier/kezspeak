import { FormEvent, useState } from "react"
import { supabase } from "../lib/supabase"

/** Set a new password for the signed-in user (also used after invite/reset links). */
export default function ChangePasswordForm({ submitLabel = "Change password", onDone }: { submitLabel?: string; onDone?: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const input = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-kez-blue"

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) return setMessage({ ok: false, text: "Use at least 8 characters." })
    if (password !== confirm) return setMessage({ ok: false, text: "The passwords don't match." })
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setMessage({
        ok: false,
        text: /reauthenticat|recent/i.test(error.message)
          ? "For security, log out and back in (or use “Forgot password?”), then try again."
          : error.message,
      })
      return
    }
    setPassword("")
    setConfirm("")
    setMessage({ ok: true, text: "✓ Password updated." })
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      <button type="submit" disabled={saving} className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "Saving…" : submitLabel}
      </button>
      {message && (
        <p className={`rounded-xl p-3 text-xs font-bold ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}
    </form>
  )
}
