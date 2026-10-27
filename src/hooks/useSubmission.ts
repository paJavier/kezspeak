import { useCallback, useEffect, useState } from "react"
import { getSubmission, isProcessing, type Submission } from "../lib/assessments"

const POLL_MS = 2000

/** Loads a submission and keeps polling while the ML service is working on it. */
export default function useSubmission(submissionId: string | null) {
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!submissionId) {
      setSubmission(null)
      return
    }
    let cancelled = false
    let timer: number | undefined

    const load = async () => {
      try {
        const next = await getSubmission(submissionId)
        if (cancelled) return
        setSubmission(next)
        setError(null)
        if (isProcessing(next.status)) timer = window.setTimeout(load, POLL_MS)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    load()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [submissionId, version])

  return { submission, error, refresh }
}
