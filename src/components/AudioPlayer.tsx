import { useEffect, useState } from "react"
import { getSignedAudioUrl } from "../lib/assessments"

/** Plays a private recording through a short-lived signed URL. */
export default function AudioPlayer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    getSignedAudioUrl(path)
      .then((signed) => !cancelled && setUrl(signed))
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [path])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!url) return <p className="text-sm text-slate-400">Loading recording…</p>
  return <audio controls src={url} className="w-full" />
}
